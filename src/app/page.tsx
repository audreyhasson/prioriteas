import SignIn from "@/components/sign-in";
import SignOut from "@/components/sign-out";
import { auth } from "@/auth";
import Link from "next/link";
import CalendarView from "@/components/calendar-view-v2";
import { CalendarEvent } from "./scheduler/classes";

export default async function Home() {

  const session = await auth();

  return (
    <div>
      <h1>prioriteas</h1>
      {session && 
      <div>
        {/* <p>Hello, {session?.user?.email}</p> */}
        <p>Go make your <Link href="/schedule">schedule</Link>.</p>
        </div>}
      {session ? <SignOut/> : <SignIn/>}
    </div>
  );
}
