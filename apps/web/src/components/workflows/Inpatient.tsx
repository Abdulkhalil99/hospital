'use client';
import { useCallback,useEffect,useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card,Form,Records,Row,can,options,patientLabel,str,useLookups } from './WorkflowUI';

export function Inpatient({locale}:{locale:string}){
 const [beds,setBeds]=useState<Row[]>([]),[rows,setRows]=useState<Row[]>([]),[selected,setSelected]=useState<Row|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const lookups=useLookups();
 const load=useCallback(async()=>{try{const [b,a]=await Promise.all([api.get<Row[]>('/inpatient/beds'),api.get<Row[]>('/inpatient')]);setBeds(b);setRows(a);setError('');}catch(e){setError((e as Error).message);}},[]);
 useEffect(()=>{void load();},[load]);
 async function open(id:string){try{setSelected(await api.get<Row>('/inpatient/'+id));setError('');}catch(e){setError((e as Error).message);}}
 async function action(path:string,data:Record<string,unknown>){await api.post(path,data);setNotice('Saved successfully.');await load();if(selected)await open(selected.id);}
 const free=options(beds.filter(b=>b.available&&!b.admission_id),b=>`${b.ward} · ${b.label}`);
 const rx=(selected?.prescriptions??[]) as Row[];
 return <>{(error||lookups.error)&&<p role="alert" className="workflow-error">{error||lookups.error}</p>}{notice&&<p role="status" className="workflow-notice">{notice}</p>}
 <div className="workflow-metrics"><div><strong>{beds.length}</strong> beds</div><div><strong>{free.length}</strong> available</div><div><strong>{rows.filter(r=>r.status==='admitted').length}</strong> admitted</div></div>
 <Card title="Ward bed board"><div className="workflow-bedboard">{beds.map(b=><button key={b.id} className={b.admission_id?'occupied':'free'} disabled={!b.admission_id} onClick={()=>open(str(b.admission_id))}><strong>{str(b.ward)} · {str(b.label)}</strong><span>{b.admission_id?`${b.first_name} ${b.last_name} · ${b.mrn}`:'Available'}</span></button>)}</div>
 {can('operations:manage')&&<details><summary>Add a bed</summary><Form label="Add bed" fields={[{name:'ward',label:'Ward'},{name:'label',label:'Bed label'}]} onSubmit={d=>action('/inpatient/beds',d)}/></details>}</Card>
 {can('inpatient:write')&&<Card title="Admit a patient">{lookups.search}<Form label="Admit patient" fields={[{name:'patientId',label:'Patient',options:options(lookups.patients,patientLabel)},{name:'doctorId',label:'Attending doctor',options:options(lookups.doctors,r=>str(r.full_name))},{name:'bedId',label:'Available bed',options:free},{name:'reason',label:'Reason for admission',type:'textarea'}]} onSubmit={async d=>{const a=await api.post<Row>('/inpatient',d);await load();await open(a.id);}}/></Card>}
 <Card title="Admissions"><Records rows={rows} columns={[{key:'mrn',label:'Patient',render:patientLabel},{key:'ward',label:'Ward'},{key:'bed_label',label:'Bed'},{key:'status',label:'Status'}]} onSelect={r=>open(r.id)}/></Card>
 {selected&&<Card title={`${patientLabel(selected)} · ${selected.status}`}><p><Link href={`/${locale}/dashboard/doctor/emr/${selected.encounter_id}`}>Open clinical chart, orders and results →</Link></p>
 <p>Admission reason: {str(selected.reason)}</p>
 {selected.status==='admitted'&&<>
 {can('inpatient:write')&&<details><summary>Transfer to another bed</summary><Form label="Transfer" fields={[{name:'bedId',label:'Destination bed',options:free},{name:'reason',label:'Reason'}]} onSubmit={d=>action(`/inpatient/${selected.id}/transfer`,d)}/></details>}
 {can('inpatient:write')&&<details><summary>Reconcile medications</summary><Reconcile onSave={d=>action(`/inpatient/${selected.id}/reconcile`,d)}/></details>}
 {can('inpatient:administer')&&<details><summary>Record medication administration</summary><p>Verify the patient wristband and prescription before recording each dose.</p><Form label="Record dose" fields={[{name:'prescriptionId',label:'Prescription',options:options(rx.filter(r=>r.status!=='cancelled'),r=>`${r.drug_name} · ${r.dosage} · ${r.route} · ${r.frequency} (${r.status})`)},{name:'patientMrn',label:'Scanned patient MRN'},{name:'scheduledAt',label:'Scheduled dose time',type:'datetime-local'},{name:'status',label:'Outcome',options:['given','held','refused'].map(value=>({value,label:value}))},{name:'dose',label:'Dose exactly as prescribed'},{name:'route',label:'Route exactly as prescribed'},{name:'reason',label:'Reason / notes',optional:true},{name:'witnessId',label:'Clinical witness (required for controlled medication)',optional:true,options:options(lookups.users,r=>str(r.full_name))}]} onSubmit={d=>action(`/inpatient/${selected.id}/administrations`,d)}/></details>}
 {can('inpatient:write')&&<details><summary>Discharge patient</summary><Form label="Complete discharge" fields={[{name:'summary',label:'Discharge summary',type:'textarea'},{name:'followUp',label:'Follow-up instructions',type:'textarea'},{name:'pendingResultsPlan',label:'Pending results and responsible clinician',type:'textarea',optional:true}]} onSubmit={d=>action(`/inpatient/${selected.id}/discharge`,d)}/></details>}
 </>}
 {Boolean(selected.discharge_summary)&&<p>{str(selected.discharge_summary)}<br/>Follow-up: {str(selected.follow_up)}</p>}
 <h3>Medication administration record</h3><Records rows={(selected.administrations??[]) as Row[]} columns={[{key:'drug_name',label:'Medication'},{key:'scheduled_at',label:'Dose time',render:r=>new Date(str(r.scheduled_at)).toLocaleString()},{key:'dose',label:'Dose'},{key:'status',label:'Outcome'},{key:'staff_name',label:'Recorded by'},{key:'reason',label:'Reason'}]}/>
 <h3>Medication reconciliation</h3>{((selected.reconciliations??[]) as Row[]).map(r=><div key={r.id} className="workflow-note"><strong>{str(r.phase)}</strong> · {str(r.notes)}<ul>{(r.medications as Record<string,string>[]).map((m,i)=><li key={i}>{m.action}: {m.name} {m.dose} — {m.instructions}</li>)}</ul></div>)}
 <h3>Lab orders</h3><Records rows={(selected.labOrders??[]) as Row[]} columns={[{key:'test_name',label:'Test'},{key:'status',label:'Status'}]}/>
 <h3>Care timeline</h3><Records rows={(selected.events??[]) as Row[]} columns={[{key:'event_type',label:'Event'},{key:'actor_name',label:'Staff'},{key:'created_at',label:'Time',render:r=>new Date(str(r.created_at)).toLocaleString()}]}/>
 </Card>}</>;
}
function Reconcile({onSave}:{onSave:(d:Record<string,unknown>)=>Promise<void>}){
 const [meds,setMeds]=useState<Record<string,string>[]>([]);
 return <><Records rows={meds.map((m,i)=>({...m,id:String(i)}))} columns={[{key:'name',label:'Medication'},{key:'dose',label:'Dose'},{key:'action',label:'Decision'},{key:'instructions',label:'Instructions'}]} onSelect={r=>setMeds(m=>m.filter((_,i)=>i!==Number(r.id)))}/>
 <p>Select Open to remove a medication before saving.</p>
 <Form label="Add medication to reconciliation" fields={[{name:'name',label:'Medication'},{name:'dose',label:'Dose'},{name:'action',label:'Decision',options:['continue','stop','change','start'].map(value=>({value,label:value}))},{name:'instructions',label:'Instructions',optional:true}]} onSubmit={async d=>setMeds(m=>[...m,Object.fromEntries(Object.entries({...d,instructions:d.instructions??''}).map(([k,v])=>[k,str(v)]))])}/>
 <Form label="Save reconciliation" fields={[{name:'phase',label:'Phase',options:[{value:'admission',label:'Admission'},{value:'discharge',label:'Discharge'}]},{name:'notes',label:'Review notes (record no medications if applicable)',type:'textarea'}]} onSubmit={async d=>{await onSave({...d,medications:meds});setMeds([]);}}/></>;
}
