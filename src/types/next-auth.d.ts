import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      sessionVersion: number;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    sessionVersion: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email: string;
    sessionVersion: number;
    invalid?: boolean;
  }
}
