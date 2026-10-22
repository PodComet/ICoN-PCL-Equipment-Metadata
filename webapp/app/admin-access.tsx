'use client';
import {useState} from 'react';
import {LockKeyhole,ShieldCheck} from 'lucide-react';
export default function AdminAccess({onUnlocked}:{signedIn:boolean;onUnlocked:()=>void}){
 const [password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function unlock(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const res=await fetch('/api/admin/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});const body=await res.json() as {error?:string};setPassword('');if(!res.ok)throw new Error(body.error);onUnlocked();}catch(e){setError(e instanceof Error?e.message:'Could not unlock administration.');}finally{setBusy(false);}}
 return <main className="admin-page"><div className="section-intro"><p className="eyebrow">CURATOR ACCESS</p><h2><LockKeyhole size={25}/> Administration</h2><p>Enter the shared administrator password to access the ontology, CSV updates and private Purdue inventory.</p></div><section className="admin-access-panel"><form onSubmit={unlock}><label htmlFor="admin-password">Administrator password</label><input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} maxLength={256} required disabled={busy}/><p>Access lasts up to 8 hours in this browser.</p>{error&&<p role="alert" className="error-box">{error}</p>}<button className="primary-button" disabled={!password||busy}><ShieldCheck size={17}/>{busy?'Unlocking…':'Unlock administration'}</button></form></section></main>;
}
