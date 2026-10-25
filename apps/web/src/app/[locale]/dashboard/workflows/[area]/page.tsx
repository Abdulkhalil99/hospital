'use client';
import { Inpatient } from '@/components/workflows/Inpatient';
import { Operations,Documents,Radiology,Supplies } from '@/components/workflows/Operations';
import { WorkflowPage } from '@/components/workflows/WorkflowUI';

const titles:Record<string,string>={inpatient:'Inpatient care',theatre:'Operating theatre',insurance:'Insurance claims',hr:'Staff shifts',referral:'Referrals',inventory:'Hospital supplies',documents:'Patient documents',radiology:'Radiology'};
export default function Page({params:{locale,area}}:{params:{locale:string;area:string}}){
 return <WorkflowPage locale={locale} title={titles[area]??'Hospital workspace'}>
 {area==='inpatient'?<Inpatient locale={locale}/>:area==='inventory'?<Supplies/>:area==='documents'?<Documents/>:area==='radiology'?<Radiology/>:['theatre','insurance','hr','referral'].includes(area)?<Operations area={area}/>:<p>Choose a workspace from the menu.</p>}
 </WorkflowPage>;
}
