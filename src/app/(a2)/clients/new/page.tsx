import Link from "next/link";
import { NewPersonIntake } from "./NewPersonIntake";

export const dynamic = "force-dynamic";

export default async function NewPerson({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <>
      <header className="a2s-head">
        <h1>Add new person</h1>
        <p className="a2s-sub">
          Capture the call in plain words, then review the details before finding help.
        </p>
      </header>

      <div className="a2s-btn-row a2s-intake-back">
        <Link className="a2s-matte a2s-btn a2s-btn-sm" href="/clients">
          Back to people
        </Link>
      </div>

      <NewPersonIntake initialError={error ?? null} />
    </>
  );
}
