import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from './db';
import { hashPassword, verifyPassword } from './crypto';
import { clearPublicRateLimit, enforcePublicRateLimit } from './public-rate-limit';

// Keep missing-account attempts on the same PBKDF2 path as wrong passwords.
// This value is intentionally process-local and contains no user credential.
const DUMMY_PASSWORD_HASH = hashPassword('forms-auth-enumeration-dummy');

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

        const email = credentials.email.trim().toLowerCase();

        // Durable per-email limit shared by every application instance.
        const limitCheck = await enforcePublicRateLimit({
          scope: 'login-email', formId: 'credentials', clientId: email,
          maxRequests: 20, windowSeconds: 900,
        });
        if (!limitCheck.allowed) return null;

        try {
          const user = await db.user.findUnique({ where: { email } });

          // Always run PBKDF2, even for an unknown account, so the observable
          // credential path does not reveal whether the email exists.
          const passwordMatch = verifyPassword(credentials.password, user?.password ?? DUMMY_PASSWORD_HASH);

          if (!user || !passwordMatch) return null;

          // Successful login clears prior attempts for this email.
          await clearPublicRateLimit('login-email', 'credentials', email);

          // Note: bcrypt hashes from pre-PBKDF2 versions are not supported.
          // Affected users must re-register.

          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        } catch (error) {
          console.error('[AUTH] Error during authorization:', error);
          return null;
        }
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
  debug: false,
};
