// No-auth mode: memory-os is self-hosted. All pages get a permanent local session.
const LOCAL_SESSION = {
  user: {
    id: 'local',
    email: 'local@memory-os.local',
    name: 'Local User',
    emailVerified: true,
    image: null as string | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  session: { id: 'local', userId: 'local', expiresAt: new Date(Date.now() + 86_400_000 * 365) },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useSession = (): any => ({ data: LOCAL_SESSION, isPending: false });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const signIn: any = { email: async () => ({ data: LOCAL_SESSION, error: null }) };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const signUp: any = { email: async () => ({ data: LOCAL_SESSION, error: null }) };
export const signOut = async (): Promise<void> => {};
