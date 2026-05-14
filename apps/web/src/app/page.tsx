import { redirect } from 'next/navigation';
export default function RootPage() {
  redirect('/en');
}
// # Start Docker containers
// cd ~/Desktop/medicore/infrastructure/docker && docker compose up -d && cd ../.. && pnpm dev
