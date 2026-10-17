'use client';
import {useState} from 'react';
import {FlaskConical} from 'lucide-react';
import {safeUrl} from './catalog-lib';
import {materialPhoto,type MaterialImage,type MaterialImages} from './material-options';
import imageData from './data/material-images.json';
export const materialImages=imageData as MaterialImages;
export default function MaterialPhoto({name,image,compact=false,reference=false,linked=true}:{name:string;image?:MaterialImage|null;compact?:boolean;reference?:boolean;linked?:boolean}){
 const chosen=image===undefined?materialPhoto(name,materialImages):image,[failed,setFailed]=useState('');
 const show=chosen&&safeUrl(chosen.image_url)&&failed!==chosen.image_url;
 const picture=show?<img src={safeUrl(chosen.image_url)} alt={chosen.scope} title={chosen.scope+' · '+chosen.author+' · '+chosen.license} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(chosen.image_url)}/>:null;
 const credit=show?<>{reference&&<strong>Representative reference image · </strong>}{chosen.scope}<span>{chosen.author} · <a href={safeUrl(chosen.source_url)} target="_blank" rel="noopener noreferrer">Photo source</a> · <a href={safeUrl(chosen.license_url)} target="_blank" rel="noopener noreferrer">{chosen.license}</a>{chosen.article_url&&<> · <a href={safeUrl(chosen.article_url)} target="_blank" rel="noopener noreferrer">Source article</a></>}</span></>:null;
 const Frame=compact?'span':'figure';
 return <Frame className={'material-photo '+(compact?'compact':'')+(reference?' reference':'')}>
  {show?(compact&&linked?<a href={safeUrl(chosen.source_url)} target="_blank" rel="noopener noreferrer" aria-label={name+' photo · '+chosen.author+' · '+chosen.license}>{picture}</a>:picture):<span className="material-photo-empty"><FlaskConical size={compact?17:24}/>{!compact&&<span>Photo not yet sourced</span>}</span>}
  {show&&!compact&&<figcaption>{reference?credit:<details><summary>Photo &amp; credits</summary>{credit}</details>}</figcaption>}
 </Frame>;
}
