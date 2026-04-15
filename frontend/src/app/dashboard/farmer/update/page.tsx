import { Suspense } from 'react';
import BatchUpdatePage from '../../[role]/update/page';

export default function FarmerUpdateAliasPage() {
	return (
		<Suspense fallback={<div className="p-4 text-sm text-slate-500">Đang tải...</div>}>
			<BatchUpdatePage />
		</Suspense>
	);
}
