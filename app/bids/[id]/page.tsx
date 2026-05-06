import BiddingManager from '@/components/BiddingManager';

export default async function BidPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <BiddingManager bidId={resolvedParams.id} />;
}
