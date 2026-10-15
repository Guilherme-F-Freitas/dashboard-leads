'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login(){
  const router=useRouter(),[form,setForm]=useState({usuario:'',senha:''}),[error,setError]=useState(''),[loading,setLoading]=useState(false),[show,setShow]=useState(false);
  async function submit(e){e.preventDefault();setLoading(true);setError('');try{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)}),d=await r.json();if(!r.ok)throw Error(d.error);router.push('/');router.refresh()}catch(e){setError(e.message||'Não foi possível entrar.')}finally{setLoading(false)}}
  return <main className="login-page"><div className="login-shell"><div className="login-brand"><span>◒</span><b>BONA CHOPP</b></div><form className="login-card" onSubmit={submit}><div className="gold-line"/><div className="login-content"><p className="eyebrow">PAINEL COMERCIAL</p><h1>Bem-vindo de volta.</h1><p className="subtle">Acesse a operação, os pedidos e os atendimentos em um só lugar.</p><label>Usuário<input required autoFocus autoComplete="username" value={form.usuario} onChange={e=>setForm({...form,usuario:e.target.value})}/></label><label>Senha<div className="password"><input required type={show?'text':'password'} autoComplete="current-password" value={form.senha} onChange={e=>setForm({...form,senha:e.target.value})}/><button type="button" onClick={()=>setShow(!show)}>{show?'Ocultar':'Mostrar'}</button></div></label>{error&&<div className="form-error">{error}</div>}<button className="primary wide" disabled={loading}>{loading?'Entrando...':'Entrar no painel →'}</button><small>🔒 Sessão protegida e acesso exclusivo da equipe.</small></div></form></div></main>
}
