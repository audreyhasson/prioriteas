"use client"
import { signIn } from "next-auth/react"
 
export default function SignIn() {
  return (
    // <form
    //   action={() => {
    //     signIn("google")
    //   }}
    // >
      <button type="submit" onClick={() => {
        signIn("google")
      }}>Signin with Google</button>
    // </form>
  )
} 