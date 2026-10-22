import Catalog from "./catalog";
import { getCurrentUser } from "./current-user";
export const dynamic = "force-dynamic";
export default async function Home() {
 const user = await getCurrentUser();
 return <Catalog user={user ? {name:user.displayName,email:user.email} : null} />;
}
