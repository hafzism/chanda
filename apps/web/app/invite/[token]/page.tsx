import { Brand } from '../../../components/brand';
import { InvitationCard } from '../../../components/invitations/invitation-card';

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="invitation-route">
      <Brand />
      <InvitationCard token={token} />
    </main>
  );
}
