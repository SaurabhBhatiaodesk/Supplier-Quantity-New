import { LoaderFunctionArgs } from '@remix-run/node';
import { authenticate } from '../shopify.server';
import ConnectionManagement from '../components/ConnectionManagement';

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return null;
}

export default function ConnectionManagementRoute() {
  return <ConnectionManagement />;
}


