import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { ExamType } from "@/lib/enums";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        name: { label: "Name", type: "text" },
        targetExam: { label: "TargetExam", type: "text" },
        mode: { label: "Mode", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const mode = credentials.mode ?? "login";

        if (mode === "register") {
          const exists = await prisma.user.findUnique({
            where: { email: credentials.email },
          });
          if (exists) throw new Error("EMAIL_TAKEN");
          const passwordHash = await bcrypt.hash(credentials.password, 10);
          const user = await prisma.user.create({
            data: {
              email: credentials.email,
              name: credentials.name || credentials.email.split("@")[0],
              passwordHash,
              targetExam: (credentials.targetExam as ExamType) ?? "CET4",
            },
          });
          return {
            id: user.id,
            email: user.email,
            name: user.name ?? undefined,
            targetExam: user.targetExam,
          };
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user) return null;
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          targetExam: user.targetExam,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.targetExam = (user as { targetExam?: string }).targetExam;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { targetExam?: string }).targetExam = token.targetExam as string;
      }
      return session;
    },
  },
};

declare module "next-auth" {
  interface Session {
    user: { id?: string; name?: string; email?: string; targetExam?: string };
  }
  interface User {
    targetExam?: string;
  }
  interface JWT {
    targetExam?: string;
  }
}
