import EventPage from "./EventPage";

export default function Page({ params }) {
  // Next.js 15: params is a Promise, but pass down; EventPage is a client component that will read via useParams
  return <EventPage />;
}
