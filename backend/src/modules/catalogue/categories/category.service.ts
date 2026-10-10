import { withTenantContext } from '@/lib/tenant-context';
import { AppError } from '@/lib/errors';
import { slugify, uniqueSlug } from '@/lib/slugify';
import { createAuditEntry } from '@/core/audit/audit.service';
import {
  checkSlugExists,
  getExistingCategorySlugs,
  findCategoryById,
  detectCycle,
  getActiveChildren,
  getDirectChildren,
  getAllActiveCategories,
  buildCategoryTree,
  insertCategory,
  updateCategoryById,
} from './category.queries';
import type { CreateCategoryInput, UpdateCategoryInput, CategoryTreeNode } from './category.types';

// ── createCategory ────────────────────────────────────────────────────────

export async function createCategory(
  facilityId: string,
  userId: string,
  input: CreateCategoryInput,
): Promise<{ id: string; slug: string; name: string; createdAt: Date }> {
  return withTenantContext(facilityId, async (tx) => {
    // Validate parent exists if provided
    if (input.parentId) {
      const parent = await findCategoryById(input.parentId, tx);
      if (!parent) {
        throw new AppError('PARENT_NOT_FOUND', 'Parent category not found', 404);
      }
    }

    // Slug resolution
    let slug: string;
    if (input.slug) {
      const conflict = await checkSlugExists(input.slug, undefined, tx);
      if (conflict) {
        throw new AppError('SLUG_CONFLICT', `Slug "${input.slug}" already exists in this facility`, 409);
      }
      slug = input.slug;
    } else {
      const existingSlugs = await getExistingCategorySlugs(tx);
      slug = uniqueSlug(slugify(input.name), existingSlugs);
    }

    const row = await insertCategory(facilityId, userId, { ...input, slug }, tx);

    await createAuditEntry(
      {
        facilityId,
        actorId: userId,
        actorType: 'user',
        action: 'category.created',
        resourceType: 'category',
        resourceId: row.id,
        metadata: { name: row.name, slug: row.slug },
      },
      tx,
    );

    return { id: row.id, slug: row.slug, name: row.name, createdAt: row.createdAt };
  });
}

// ── updateCategory ────────────────────────────────────────────────────────

export async function updateCategory(
  facilityId: string,
  userId: string,
  categoryId: string,
  input: UpdateCategoryInput,
): Promise<{ id: string; updatedAt: Date }> {
  return withTenantContext(facilityId, async (tx) => {
    const category = await findCategoryById(categoryId, tx);
    if (!category) {
      throw new AppError('CATEGORY_NOT_FOUND', 'Category not found', 404);
    }

    // Slug conflict check (exclude self)
    let slug: string | undefined;
    if (input.slug !== undefined && input.slug !== null && input.slug !== category.slug) {
      const conflict = await checkSlugExists(input.slug, categoryId, tx);
      if (conflict) {
        throw new AppError('SLUG_CONFLICT', `Slug "${input.slug}" already exists in this facility`, 409);
      }
      slug = input.slug;
    }

    // Parent change cycle detection
    if (input.parentId !== undefined && input.parentId !== category.parentId) {
      if (input.parentId !== null) {
        // Validate parent exists
        const parent = await findCategoryById(input.parentId, tx);
        if (!parent) {
          throw new AppError('PARENT_NOT_FOUND', 'Parent category not found', 404);
        }
        // Check for cycle: would setting categoryId's parent to input.parentId create a loop?
        const cycle = await detectCycle(categoryId, input.parentId, tx);
        if (cycle) {
          throw new AppError('CYCLE_DETECTED', 'Setting this parent would create a circular hierarchy', 409);
        }
      }
    }

    const updateData = {
      ...(input.name !== undefined && { name: input.name }),
      ...(slug !== undefined && { slug }),
      ...(input.parentId !== undefined && { parentId: input.parentId }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
      ...(input.displayOrder !== undefined && { displayOrder: input.displayOrder }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    };

    const result = await updateCategoryById(categoryId, userId, updateData, tx);

    await createAuditEntry(
      {
        facilityId,
        actorId: userId,
        actorType: 'user',
        action: 'category.updated',
        resourceType: 'category',
        resourceId: categoryId,
        metadata: { changes: Object.keys(updateData) },
      },
      tx,
    );

    return result;
  });
}

// ── deactivateCategory ────────────────────────────────────────────────────

export async function deactivateCategory(
  facilityId: string,
  userId: string,
  categoryId: string,
): Promise<{ id: string; isActive: false; updatedAt: Date }> {
  return withTenantContext(facilityId, async (tx) => {
    const category = await findCategoryById(categoryId, tx);
    if (!category) {
      throw new AppError('CATEGORY_NOT_FOUND', 'Category not found', 404);
    }

    const activeChildren = await getActiveChildren(categoryId, tx);
    if (activeChildren.length > 0) {
      throw new AppError(
        'CATEGORY_HAS_ACTIVE_CHILDREN',
        `Cannot deactivate category with ${activeChildren.length} active subcategory(ies)`,
        409,
      );
    }

    const result = await updateCategoryById(categoryId, userId, { isActive: false }, tx);

    await createAuditEntry(
      {
        facilityId,
        actorId: userId,
        actorType: 'user',
        action: 'category.deactivated',
        resourceType: 'category',
        resourceId: categoryId,
      },
      tx,
    );

    return { id: result.id, isActive: false, updatedAt: result.updatedAt };
  });
}

// ── getCategoryTree ───────────────────────────────────────────────────────

export async function getCategoryTree(facilityId: string): Promise<CategoryTreeNode[]> {
  return withTenantContext(facilityId, async (tx) => {
    const rows = await getAllActiveCategories(tx);
    return buildCategoryTree(rows);
  });
}

// ── getCategoryDetail ─────────────────────────────────────────────────────

export async function getCategoryDetail(
  facilityId: string,
  categoryId: string,
): Promise<{
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  parentId: string | null;
  children: { id: string; name: string; slug: string; isActive: boolean }[];
}> {
  return withTenantContext(facilityId, async (tx) => {
    const category = await findCategoryById(categoryId, tx);
    if (!category || !category.isActive) {
      throw new AppError('CATEGORY_NOT_FOUND', 'Category not found', 404);
    }

    const children = await getDirectChildren(categoryId, tx);

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.imageUrl,
      displayOrder: category.displayOrder,
      isActive: category.isActive,
      parentId: category.parentId,
      children,
    };
  });
}
