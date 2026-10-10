import { eq, sql } from 'drizzle-orm';
import { TenantTransaction } from '@/db';
import { categories } from '@/db/schema/catalogue';
import type { CreateCategoryInput, UpdateCategoryInput, CategoryRow, CategoryTreeNode } from './category.types';

// ── Slug conflict check ───────────────────────────────────────────────────

export async function checkSlugExists(
  slug: string,
  excludeId: string | undefined,
  tx: TenantTransaction,
): Promise<boolean> {
  const condition = excludeId
    ? sql`${categories.slug} = ${slug} AND ${categories.id} != ${excludeId}`
    : eq(categories.slug, slug);
  const [row] = await tx.select({ id: categories.id }).from(categories).where(condition).limit(1);
  return !!row;
}

export async function getExistingCategorySlugs(tx: TenantTransaction): Promise<string[]> {
  const rows = await tx.select({ slug: categories.slug }).from(categories);
  return rows.map((r) => r.slug);
}

// ── Single-row lookups ────────────────────────────────────────────────────

export async function findCategoryById(
  id: string,
  tx: TenantTransaction,
): Promise<CategoryRow | undefined> {
  const [row] = await tx
    .select({
      id: categories.id,
      facilityId: categories.facilityId,
      parentId: categories.parentId,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      imageUrl: categories.imageUrl,
      displayOrder: categories.displayOrder,
      isActive: categories.isActive,
      createdAt: categories.createdAt,
      updatedAt: categories.updatedAt,
    })
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
  return row as CategoryRow | undefined;
}

// ── Cycle detection ───────────────────────────────────────────────────────
// Returns true if categoryId appears in the ancestor chain of proposedParentId
// (which would create a cycle if categoryId.parentId were set to proposedParentId).

export async function detectCycle(
  categoryId: string,
  proposedParentId: string,
  tx: TenantTransaction,
): Promise<boolean> {
  const result = await tx.execute(sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id
      FROM categories
      WHERE id = ${proposedParentId}
      UNION ALL
      SELECT c.id, c.parent_id
      FROM categories c
      JOIN ancestors a ON c.id = a.parent_id
    )
    SELECT 1 FROM ancestors WHERE id = ${categoryId} LIMIT 1
  `);
  return (result as unknown[]).length > 0;
}

// ── Active children check ─────────────────────────────────────────────────

export async function getActiveChildren(
  parentId: string,
  tx: TenantTransaction,
): Promise<{ id: string }[]> {
  return tx
    .select({ id: categories.id })
    .from(categories)
    .where(
      sql`${categories.parentId} = ${parentId} AND ${categories.isActive} = true`,
    );
}

// ── Category tree ─────────────────────────────────────────────────────────

export async function getAllActiveCategories(tx: TenantTransaction): Promise<CategoryRow[]> {
  return tx
    .select({
      id: categories.id,
      facilityId: categories.facilityId,
      parentId: categories.parentId,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      imageUrl: categories.imageUrl,
      displayOrder: categories.displayOrder,
      isActive: categories.isActive,
      createdAt: categories.createdAt,
      updatedAt: categories.updatedAt,
    })
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(categories.displayOrder) as Promise<CategoryRow[]>;
}

export function buildCategoryTree(rows: CategoryRow[]): CategoryTreeNode[] {
  const nodeMap = new Map<string, CategoryTreeNode>();
  const roots: CategoryTreeNode[] = [];

  for (const row of rows) {
    nodeMap.set(row.id, {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      imageUrl: row.imageUrl,
      displayOrder: row.displayOrder,
      isActive: row.isActive,
      children: [],
    });
  }

  for (const row of rows) {
    const node = nodeMap.get(row.id)!;
    if (row.parentId && nodeMap.has(row.parentId)) {
      nodeMap.get(row.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ── Inserts & Updates ─────────────────────────────────────────────────────

export async function insertCategory(
  facilityId: string,
  userId: string,
  data: CreateCategoryInput & { slug: string },
  tx: TenantTransaction,
): Promise<CategoryRow> {
  const [row] = await tx
    .insert(categories)
    .values({
      facilityId,
      name: data.name,
      slug: data.slug,
      parentId: data.parentId ?? null,
      description: data.description ?? null,
      imageUrl: data.imageUrl ?? null,
      displayOrder: data.displayOrder ?? 0,
      isActive: data.isActive ?? true,
      createdById: userId,
      updatedById: userId,
    })
    .returning({
      id: categories.id,
      facilityId: categories.facilityId,
      parentId: categories.parentId,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      imageUrl: categories.imageUrl,
      displayOrder: categories.displayOrder,
      isActive: categories.isActive,
      createdAt: categories.createdAt,
      updatedAt: categories.updatedAt,
    });
  return row as CategoryRow;
}

export async function getDirectChildren(
  parentId: string,
  tx: TenantTransaction,
): Promise<{ id: string; name: string; slug: string; isActive: boolean }[]> {
  return tx
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      isActive: categories.isActive,
    })
    .from(categories)
    .where(eq(categories.parentId, parentId));
}

export async function updateCategoryById(
  id: string,
  userId: string,
  data: Partial<UpdateCategoryInput & { slug: string }>,
  tx: TenantTransaction,
): Promise<{ id: string; updatedAt: Date }> {
  const [row] = await tx
    .update(categories)
    .set({ ...data, updatedById: userId, updatedAt: new Date() })
    .where(eq(categories.id, id))
    .returning({ id: categories.id, updatedAt: categories.updatedAt });
  return row;
}
