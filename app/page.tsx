'use client';

import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, Plus, FileSpreadsheet, Trash2, Import } from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { collection, query, where, getDocs, setDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import Link from 'next/link';
import * as XLSX from 'xlsx';

interface Bid {
  id: string;
  title: string;
  ownerId: string;
  globalTransport: number;
  globalWarranty: number;
  globalIcms: number;
  globalPis: number;
  globalCofins: number;
  globalIpi: number;
  globalIss: number;
  createdAt: string;
  updatedAt: string;
}

export default function Home() {
  const { user, loading, signIn, logOut, signInWithEmail, signUpWithEmail } = useAuth();
  const [bids, setBids] = useState<Bid[]>([]);
  const [isLoadingBids, setIsLoadingBids] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const fetchBids = useCallback(async () => {
    if (!user) return;
    setIsLoadingBids(true);
    const path = 'bids';
    try {
      const q = query(collection(db, path), where('ownerId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const fetchedBids: Bid[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedBids.push({ 
          id: doc.id, 
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
        } as Bid);
      });
      setBids(fetchedBids.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    } finally {
      setIsLoadingBids(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
        setTimeout(() => {
            fetchBids();
        }, 0);
    }
  }, [user, fetchBids]);

  const createBid = async () => {
    if (!user) return;
    const bidId = crypto.randomUUID();
    
    // We omit createdAt/updatedAt types locally before sending or cast as any,
    // actually let's just make an object and then send it.
    const newBid = {
      title: `Nova Licitação - ${new Date().toLocaleDateString('pt-BR')}`,
      ownerId: user.uid,
      globalTransport: 0,
      globalWarranty: 0,
      globalIcms: 0,
      globalPis: 0,
      globalCofins: 0,
      globalIpi: 0,
      globalIss: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const path = `bids/${bidId}`;
    try {
      await setDoc(doc(db, 'bids', bidId), newBid);
      fetchBids();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const deleteLocalBid = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta licitação?')) return;
    const path = `bids/${id}`;
    try {
      await deleteDoc(doc(db, 'bids', id));
      fetchBids();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);
    try {
      if (isLoginMode) {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Erro de autenticação. Verifique se o provedor Email/Senha está habilitado no Firebase.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex bg-gray-900 h-screen w-full items-center justify-center p-4">
        <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700 max-w-sm w-full space-y-6">
           <div className="text-center space-y-2">
             <div className="mx-auto w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center border-4 border-gray-700 shadow-inner mb-4">
               <FileSpreadsheet className="text-blue-500 h-10 w-10" />
             </div>
             <h1 className="text-3xl font-extrabold text-white tracking-tight italic uppercase">
               Formação <span className="text-red-500">De Preço</span>
             </h1>
             <p className="text-gray-400 font-medium text-sm">Acesso restrito</p>
           </div>
           
           <form onSubmit={handleEmailAuth} className="space-y-4">
             {authError && (
               <div className="bg-red-500/10 border border-red-500 text-red-500 text-xs p-3 rounded-md">
                 {authError}
               </div>
             )}
             
             <div className="space-y-3">
               <input 
                 type="email" 
                 required 
                 placeholder="Seu email" 
                 value={email}
                 onChange={e => setEmail(e.target.value)}
                 className="w-full h-12 bg-gray-900 border border-gray-700 text-white rounded-lg px-4 focus:ring-2 focus:ring-blue-500 focus:outline-none"
               />
               <input 
                 type="password" 
                 required 
                 placeholder="Sua senha" 
                 value={password}
                 onChange={e => setPassword(e.target.value)}
                 className="w-full h-12 bg-gray-900 border border-gray-700 text-white rounded-lg px-4 focus:ring-2 focus:ring-blue-500 focus:outline-none"
               />
             </div>
             
             <Button type="submit" disabled={isAuthLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-base font-bold shadow-lg">
               {isAuthLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (isLoginMode ? 'Entrar com Email e Senha' : 'Criar minha conta')}
             </Button>
           </form>
           
           <div className="flex items-center justify-center space-x-2 text-sm">
              <span className="text-gray-400">{isLoginMode ? 'Não tem conta?' : 'Já tem conta?'}</span>
              <button type="button" onClick={() => setIsLoginMode(!isLoginMode)} className="text-blue-400 hover:text-blue-300 font-bold underline">
                {isLoginMode ? 'Cadastre-se' : 'Faça login'}
              </button>
           </div>

           <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-700"></div></div>
              <div className="relative flex justify-center text-xs"><span className="bg-gray-800 px-2 text-gray-500 uppercase tracking-widest">Ou</span></div>
           </div>

           <Button onClick={signIn} type="button" variant="outline" className="w-full bg-white text-gray-900 hover:bg-gray-100 py-6 text-base font-bold border-0">
             Entrar com Google
           </Button>
        </div>
      </div>
    );
  }

  return (
    <main className="container mx-auto py-8 px-4">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b pb-6">
        <div>
            <h1 className="text-3xl font-extrabold flex items-center gap-3 italic">
              <FileSpreadsheet className="text-blue-600" /> FORMAÇÃO <span className="text-red-600">PREÇO</span>
            </h1>
            <p className="text-gray-500 font-medium mt-1">Gerenciador de planilhas de licitação</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600 font-medium bg-gray-200 px-3 py-1 rounded-full">{user.email}</div>
            <Button variant="outline" onClick={logOut}>Sair</Button>
        </div>
      </header>

      <div className="flex justify-between items-center mb-6">
         <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">Suas Licitações</h2>
         <Button onClick={createBid} className="font-semibold bg-gray-900 hover:bg-gray-800 text-white">
           <Plus className="mr-2 h-4 w-4" /> Nova Planilha
         </Button>
      </div>

      {isLoadingBids ? (
        <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : bids.length === 0 ? (
        <div className="text-center p-16 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50">
            <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-xl font-bold text-gray-700 mb-2">Nenhuma licitação encontrada</h3>
            <p className="text-gray-500 mb-6">Crie sua primeira planilha de cálculos de licitação.</p>
            <Button onClick={createBid} className="bg-blue-600 hover:bg-blue-700 text-white">Criar Planilha</Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {bids.map((bid) => (
            <Card key={bid.id} className="shadow-md hover:shadow-lg transition-shadow bg-white flex flex-col border-gray-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg text-gray-800 line-clamp-1">{bid.title}</CardTitle>
                <CardDescription className="text-gray-500">
                   Criado em {new Date(bid.createdAt).toLocaleDateString('pt-BR')}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                 <div className="text-sm font-mono text-gray-500 bg-gray-50 p-3 rounded-md border border-gray-100">
                   {/* We might show quick stats here later */}
                   Planilha salva em nuvem
                 </div>
              </CardContent>
              <CardFooter className="flex justify-between pt-4 border-t border-gray-100">
                <Link href={`/bids/${bid.id}`}>
                    <Button variant="default" className="bg-gray-900 hover:bg-gray-800 text-white">Abrir Planilha</Button>
                </Link>
                <Button variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => deleteLocalBid(bid.id)}>
                   <Trash2 className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
