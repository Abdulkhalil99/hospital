'use client';
import { useCallback,useEffect,useState } from 'react';
import { api } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { Card,Field,Form,Records,Row,options,patientLabel,str,useLookups } from './WorkflowUI';

const detailFields:Record<string,Field[]>={
 theatre:[{name:'room',label:'Operating room'},{name:'procedure',label:'Procedure'},{name:'startsAt',label:'Starts',type:'datetime-local'},{name:'endsAt',label:'Ends',type:'datetime-local'}],
 insurance:[{name:'invoiceId',label:'Invoice ID'},{name:'payer',label:'Payer'},{name:'policyNumber',label:'Policy number'},{name:'amount',label:'Claim amount',type:'number'}],
 hr:[{name:'department',label:'Department'},{name:'startsAt',label:'Shift starts',type:'datetime-local'},{name:'endsAt',label:'Shift ends',type:'datetime-local'},{name:'notes',label:'Notes',optional:true}],
 referral:[{name:'destination',label:'Receiving provider / facility'},{name:'reason',label:'Reason for referral',type:'textarea'},{name:'urgency',label:'Urgency',options:[{value:'routine',label:'Routine'},{value:'urgent',label:'Urgent'}]}],
};
function transitionFields(area:string,status:string):Field[]{
 if(area==='theatre'&&status==='in_progress')return [{name:'consentConfirmed',label:'Patient consent confirmed',type:'checkbox'},{name:'checklistComplete',label:'Surgical safety checklist completed',type:'checkbox'}];
 if(area==='theatre'&&status==='completed')return [{name:'operativeNote',label:'Operative note',type:'textarea'}];
 if(area==='insurance')return status==='denied'?[{name:'decisionReason',label:'Denial reason'}]:[{name:'payerReference',label:'Payer / remittance reference'}];
 if(area==='referral'&&status==='completed')return [{name:'outcome',label:'Outcome and follow-up',type:'textarea'}];
 return [];
}
export function Operations({area}:{area:string}){
 const [rows,setRows]=useState<Row[]>([]),[transitions,setTransitions]=useState<Record<string,string[]>>({}),[selected,setSelected]=useState<Row|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const lookups=useLookups();
 const load=useCallback(async()=>{try{const d=await api.get<{rows:Row[];transitions:Record<string,string[]>}>('/operations/tasks/'+area);setRows(d.rows);setTransitions(d.transitions);setError('');return d.rows;}catch(e){setError((e as Error).message);return [];}},[area]);
 useEffect(()=>{setSelected(null);void load();},[load]);
 const fields:Field[]=[{name:'title',label:area==='hr'?'Shift label':'Case title'},...(area==='hr'?[]:[{name:'patientId',label:'Patient',options:options(lookups.patients,patientLabel)}]),{name:'assignedTo',label:'Assigned staff member',options:options(lookups.users,r=>str(r.full_name)),optional:area!=='hr'},...detailFields[area]];
 return <>{(error||lookups.error)&&<p role="alert" className="workflow-error">{error||lookups.error}</p>}{notice&&<p role="status" className="workflow-notice">{notice}</p>}
 <Card title="Create a record">{area!=='hr'&&lookups.search}{area==='insurance'&&<p>Track claim submissions and payer decisions here. Record the reference from your payer for each external action.</p>}
 <Form key={area} fields={fields} label="Create record" onSubmit={async d=>{const {title,patientId,assignedTo,...details}=d;await api.post('/operations/tasks/'+area,{title,patientId,assignedTo,details});await load();setNotice('Record created.');}}/></Card>
 <Card title="Worklist"><Records rows={rows} columns={[{key:'title',label:'Title'},{key:'mrn',label:'Patient',render:r=>r.mrn?patientLabel(r):'—'},{key:'assignee_name',label:'Assigned to'},{key:'status',label:'Status'},{key:'created_at',label:'Created',render:r=>new Date(str(r.created_at)).toLocaleDateString()}]} onSelect={setSelected}/></Card>
 {selected&&<Card title={str(selected.title)}><p>Status: <strong>{str(selected.status)}</strong></p><dl className="workflow-fields">{Object.entries(selected.details as Record<string,unknown>).map(([k,v])=><div key={k}><dt>{k.replace(/([A-Z])/g,' $1')}</dt><dd>{str(v)}</dd></div>)}</dl>
 {(transitions[str(selected.status)]??[]).map(status=><details key={status}><summary>Mark {status.replaceAll('_',' ')}</summary><Form fields={[{name:'note',label:'Reason / handoff note',type:'textarea'},...transitionFields(area,status)]} label={'Confirm '+status.replaceAll('_',' ')} onSubmit={async d=>{const {note,...details}=d;const updated=await api.post<Row>(`/operations/tasks/${area}/${selected.id}/transition`,{status,note,details});await load();setSelected(updated);setNotice('Status updated.');}}/></details>)}
 <h3>History</h3><Records rows={(selected.history??[]) as Row[]} columns={[{key:'status',label:'Status'},{key:'note',label:'Note'},{key:'created_at',label:'Time',render:r=>new Date(str(r.created_at)).toLocaleString()}]}/></Card>}</>;
}
export function Supplies(){
 const [rows,setRows]=useState<Row[]>([]),[selected,setSelected]=useState<Row|null>(null),[history,setHistory]=useState<Row[]>([]),[error,setError]=useState('');
 const load=useCallback(async()=>{try{setRows(await api.get<Row[]>('/operations/supplies'));setError('');}catch(e){setError((e as Error).message);}},[]);
 useEffect(()=>{void load();},[load]);
 async function open(r:Row){setSelected(r);try{setHistory(await api.get<Row[]>(`/operations/supplies/${r.id}/movements`));}catch(e){setError((e as Error).message);}}
 return <>{error&&<p role="alert" className="workflow-error">{error}</p>}<Card title="Hospital supplies"><Records rows={rows} columns={[{key:'sku',label:'SKU'},{key:'name',label:'Supply'},{key:'location',label:'Location'},{key:'quantity',label:'On hand'},{key:'unit',label:'Unit'},{key:'reorder_level',label:'Stock alert',render:r=>Number(r.quantity)<=Number(r.reorder_level)?'Reorder':'In stock'}]} onSelect={open}/></Card>
 <Card title="Add supply"><Form fields={[{name:'sku',label:'SKU'},{name:'name',label:'Name'},{name:'unit',label:'Unit'},{name:'location',label:'Store location'},{name:'reorderLevel',label:'Reorder at',type:'number',value:0}]} label="Add supply" onSubmit={async d=>{await api.post('/operations/supplies',d);await load();}}/></Card>
 {selected&&<Card title={str(selected.name)}><p>Use a positive quantity to receive stock and a negative quantity to issue stock. Include a purchase order, supplier delivery, or department reference.</p><Form fields={[{name:'quantity',label:'Quantity change',type:'number'},{name:'reason',label:'Reason'},{name:'reference',label:'Source / destination reference'}]} label="Record movement" onSubmit={async d=>{const r=await api.post<Row>(`/operations/supplies/${selected.id}/movements`,d);await load();await open(r);}}/><Records rows={history} columns={[{key:'quantity',label:'Change'},{key:'reason',label:'Reason'},{key:'reference',label:'Reference'},{key:'created_at',label:'Time',render:r=>new Date(str(r.created_at)).toLocaleString()}]}/></Card>}</>;
}
export function Radiology(){
 const [rows,setRows]=useState<Row[]>([]),[selected,setSelected]=useState<Row|null>(null),[error,setError]=useState('');
 const load=useCallback(async()=>{try{setRows(await api.get<Row[]>('/radiology'));setError('');}catch(e){setError((e as Error).message);}},[]);
 useEffect(()=>{void load();},[load]);
 const status=selected?({ordered:'scheduled',scheduled:'performed',performed:'reported'} as Record<string,string>)[str(selected.status)]:null;
 const fields:Field[]=status==='scheduled'?[{name:'scheduledAt',label:'Scheduled scan time',type:'datetime-local'}]:status==='performed'?[{name:'studyUid',label:'DICOM study UID',optional:true}]:[{name:'reportText',label:'Signed imaging report',type:'textarea'}];
 return <>{error&&<p role="alert" className="workflow-error">{error}</p>}<Card title="Imaging worklist"><p>Imaging requests appear here when ordered from the clinical chart.</p><Records rows={rows} columns={[{key:'mrn',label:'Patient',render:patientLabel},{key:'modality',label:'Modality'},{key:'body_part',label:'Body part'},{key:'urgency',label:'Priority'},{key:'status',label:'Status'}]} onSelect={setSelected}/></Card>{selected&&<Card title={`${patientLabel(selected)} · ${selected.modality}`}><p>{str(selected.clinical_indication)}</p>{selected.report_text&&<p>{str(selected.report_text)}</p>}{status&&<Form key={status} fields={fields} label={'Mark '+status} onSubmit={async d=>{const r=await api.post<Row>(`/radiology/${selected.id}/transition`,{...d,status});setSelected(r);await load();}}/>}{['ordered','scheduled'].includes(str(selected.status))&&<button className="danger" onClick={async()=>{try{await api.post(`/radiology/${selected.id}/transition`,{status:'cancelled'});setSelected(null);await load();}catch(e){setError((e as Error).message);}}}>Cancel imaging order</button>}</Card>}</>;
}
export function Documents(){
 const lookups=useLookups(),[patient,setPatient]=useState(''),[rows,setRows]=useState<Row[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{if(!patient){setRows([]);return;}try{setRows(await api.get<Row[]>('/operations/documents?patientId='+patient));setError('');}catch(e){setError((e as Error).message);}},[patient]);
 useEffect(()=>{void load();},[load]);
 async function upload(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);const form=e.currentTarget,d=new FormData(form),file=d.get('file') as File;try{
  if(file.size>5_000_000)throw new Error('Maximum file size is 5 MB.');
  const content=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(file);});
  await api.post('/operations/documents',{patientId:patient,title:d.get('title'),filename:file.name,mimeType:file.type,content});form.reset();await load();
 }catch(err){setError((err as Error).message);}finally{setBusy(false);}}
 async function download(r:Row){try{const res=await fetch(`${process.env.NEXT_PUBLIC_API_URL??'http://localhost:3000/api/v1'}/operations/documents/${r.id}/download`,{headers:{Authorization:'Bearer '+getSession()?.accessToken}});if(!res.ok)throw new Error('Download failed.');const url=URL.createObjectURL(await res.blob());const a=document.createElement('a');a.href=url;a.download=str(r.filename);a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError((e as Error).message);}}
 return <>{(error||lookups.error)&&<p role="alert" className="workflow-error">{error||lookups.error}</p>}<Card title="Patient documents">{lookups.search}<label>Patient<select value={patient} onChange={e=>setPatient(e.target.value)}><option value="">Select patient…</option>{lookups.patients.map(p=><option key={p.id} value={p.id}>{patientLabel(p)}</option>)}</select></label>{patient&&<><Records rows={rows} columns={[{key:'title',label:'Document'},{key:'filename',label:'File'},{key:'created_at',label:'Uploaded',render:r=>new Date(str(r.created_at)).toLocaleString()}]} onSelect={download}/><form className="workflow-form" onSubmit={upload}><div className="workflow-fields"><label>Document title<input name="title" required/></label><label>PDF, PNG or JPEG (up to 5 MB)<input name="file" type="file" accept="application/pdf,image/png,image/jpeg" required/></label></div><button disabled={busy}>{busy?'Uploading…':'Upload document'}</button></form></>}</Card></>;
}
