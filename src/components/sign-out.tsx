"use client"

import { signOut } from "next-auth/react"
 
export default function SignOut() {
  return (
    // <form
    //   action={() => {
    //     signOut({redirectTo: "/"})
    //   }}
    // >
      <button type="submit" onClick={() => {
        signOut({redirectTo: "/"})
      }}>Sign out</button>
    // </form>
  )
} 