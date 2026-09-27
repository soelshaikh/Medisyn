import VerifyEmailContent from "./VerifyEmailContent";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  return <VerifyEmailContent token={token} />;
}
