'use client';
import { FormEvent,useEffect,useState } from 'react';
import { api } from '@/lib/api';
import { getSession,hasPermission } from '@/lib/auth';
import { DashboardShell } from '@/components/layout/DashboardShell';

export type Row=Record<string,unknown> & {id:string};
export type Option={value:string;label:string};
export type Field={name:string;label:string;type?:string;options?:Option[];optional?:boolean;value?:string|number|boolean};
export const str=(value:unknown)=>value==null?'':String(value);
export const options=(rows:Row[],label:(row:Row)=>string):Option[]=>rows.map(row=>({value:row.id,label:label(row)}));
export function can(permission:string){const user=getSession()?.user;return !!user&&hasPermission(user,permission);}
export function WorkflowPage({locale,title,children}:{locale:string;title:string;children:React.ReactNode}){
 return <DashboardShell locale={locale} title={title} navItems={[]}><div className="workflow">{children}</div></DashboardShell>;
}
export function Form({fields,label,onSubmit,initial={}}:{fields:Field[];label:string;onSubmit:(data:Record<string,unknown>)=>Promise<void>;initial?:Record<string,unknown>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();const form=e.currentTarget;const data=new FormData(form);const values:Record<string,unknown>={};
  for(const f of fields){const v=data.get(f.name);if(f.type==='checkbox'){values[f.name]=v==='on';continue;}if(f.optional&&!v)continue;
   values[f.name]=f.type==='number'?Number(v):f.type==='datetime-local'?new Date(String(v)).toISOString():v;}
  setBusy(true);setError('');try{await onSubmit(values);form.reset();}catch(err){setError(err instanceof Error?err.message:'Could not save.');}finally{setBusy(false);}
 }
 return <form onSubmit={submit} className="workflow-form"><div className="workflow-fields">{fields.map(f=><label key={f.name}>{f.label}{!f.optional&&f.type!=='checkbox'?' *':''}
  {f.options?<select name={f.name} required={!f.optional} defaultValue={str(initial[f.name]??f.value)}><option value="">Select…</option>{f.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
  :f.type==='textarea'?<textarea name={f.name} required={!f.optional} defaultValue={str(initial[f.name]??f.value)} rows={3}/>
  :f.type==='checkbox'?<input type="checkbox" name={f.name} defaultChecked={Boolean(initial[f.name]??f.value)}/>
  :<input name={f.name} type={f.type??'text'} required={!f.optional} defaultValue={str(initial[f.name]??f.value)} step={f.type==='number'?'any':undefined}/>}
 </label>)}</div>{error&&<p role="alert" className="workflow-error">{error}</p>}<button disabled={busy}>{busy?'Saving…':label}</button></form>;
}
export function Card({title,children}:{title:string;children:React.ReactNode}){return <section className="workflow-card"><h2>{title}</h2>{children}</section>;}
export function useLookups(){
 const [query,setQuery]=useState(''),[data,setData]=useState<{patients:Row[];doctors:Row[];users:Row[]}>({patients:[],doctors:[],users:[]}),[error,setError]=useState('');
 useEffect(()=>{let active=true;const timer=setTimeout(()=>{api.get<typeof data>('/operations/lookups?q='+encodeURIComponent(query)).then(v=>{if(active){setData(v);setError('');}}).catch(e=>{if(active)setError(e.message);});},250);return()=>{active=false;clearTimeout(timer);};},[query]);
 return {...data,error,search:<label className="workflow-search">Find patient by name or MRN<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search patients…"/></label>};
}
export function Records({rows,columns,onSelect}:{rows:Row[];columns:{key:string;label:string;render?:(row:Row)=>React.ReactNode}[];onSelect?:(row:Row)=>void}){
 if(!rows.length)return <p className="workflow-empty">No records yet.</p>;
 return <div className="workflow-table"><table><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}{onSelect&&<th>Actions</th>}</tr></thead><tbody>{rows.map(row=><tr key={row.id}>{columns.map(c=><td key={c.key}>{c.render?c.render(row):str(row[c.key])}</td>)}{onSelect&&<td><button className="secondary" onClick={()=>onSelect(row)}>Open</button></td>}</tr>)}</tbody></table></div>;
}
export const patientLabel=(p:Row)=>`${p.mrn} · ${p.first_name} ${p.last_name}`;
