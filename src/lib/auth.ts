import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from './db';
import bcrypt from 'bcryptjs';
import { checkRateLimit, recordRateLimitAttempt } from './rate-limit';

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Check if this email is locked out due to too many failed attempts
        // 10 failed attempts per 15-minute window
        const loginLimit = checkRateLimit(credentials.email, { maxRequests: 10, windowSeconds: 900 });
        if (!loginLimit.success) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          // Record failed attempt even when user not found (don't leak user existence)
          recordRateLimitAttempt(credentials.email);
          return null;
        }

        if (!bcrypt.compareSync(credentials.password, user.password)) {
          // Record failed attempt
          recordRateLimitAttempt(credentials.email);
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export { hashPassword };
