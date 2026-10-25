import { AuthUser,getDashboardPath,hasPermission } from './auth';
const links=[
 ['inpatient','Inpatient care','🛏️','inpatient:read'],['radiology','Radiology','🩻','radiology:read'],
 ['theatre','Operating theatre','🏥','theatre:manage'],['referral','Referrals','↗','referrals:manage'],
 ['insurance','Insurance claims','📄','insurance:manage'],['inventory','Hospital supplies','📦','inventory:manage'],
 ['documents','Patient documents','📁','documents:manage'],['hr','Staff shifts','📅','hr:manage'],
];
export function workflowNav(user:AuthUser|null,locale:string){
 if(!user)return [];
 return [{label:'Home',icon:'🏠',path:getDashboardPath(user.roles,locale)},...links.filter(([, , ,p])=>hasPermission(user,p)).map(([area,label,icon])=>({label,icon,path:`/${locale}/dashboard/workflows/${area}`}))];
}
