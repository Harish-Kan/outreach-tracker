import { redirect } from "next/navigation";

// The dashboard with metric cards and the "needs follow-up" bucket is spec
// step 5. Until then the contact list is the home screen.
export default function Home() {
  redirect("/contacts");
}
