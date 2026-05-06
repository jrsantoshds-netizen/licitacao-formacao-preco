'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { doc, getDoc, updateDoc, collection, query, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Plus, Save, Trash2, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';

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

interface BidItem {
  id: string;
  manufacturer: string;
  quantity: number;
  unitValue: number;
  icms: number;
  pis: number;
  cofins: number;
  ipi: number;
  iss: number;
  transport: number;
  warranty: number;
  margin: number;
  createdAt: string;
  updatedAt: string;
}

const parsePercent = (val: number) => (val || 0) / 100;

export default function BiddingManager({ bidId }: { bidId: string }) {
  const { user } = useAuth();
  const [bid, setBid] = useState<Bid | null>(null);
  const [items, setItems] = useState<BidItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const bidSnap = await getDoc(doc(db, 'bids', bidId));
      if (!bidSnap.exists() || bidSnap.data().ownerId !== user?.uid) {
        throw new Error('Bid not found or access denied');
      }
      const data = bidSnap.data();
      setBid({ 
            id: bidSnap.id, 
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
      } as Bid);

      const itemsQ = query(collection(db, `bids/${bidId}/items`));
      const itemsSnap = await getDocs(itemsQ);
      const fetchedItems: BidItem[] = [];
      itemsSnap.forEach((d) => {
          const idata = d.data();
          fetchedItems.push({ 
              id: d.id, 
              ...idata,
              createdAt: idata.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
              updatedAt: idata.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
          } as BidItem)
      });
      setItems(fetchedItems.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    } catch (error) {
      console.error(error);
      alert('Erro ao carregar os dados. Você tem acesso?');
    } finally {
      setLoading(false);
    }
  }, [user, bidId]);

  useEffect(() => {
    if (user && bidId) {
      loadData();
    }
  }, [user, bidId, loadData]);

  const handleUpdateBid = async (field: keyof Bid, value: number | string) => {
    if (!bid || !user) return;
    const updated = { ...bid, [field]: value, updatedAt: new Date().toISOString() };
    setBid(updated);
    try {
      await updateDoc(doc(db, 'bids', bidId), { [field]: value, updatedAt: serverTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bids/${bidId}`);
    }
  };

  const addItem = async () => {
    if (!bid || !user) return;
    const itemId = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Add locally immediately with a string for UI render
    const localItem = {
      manufacturer: '',
      quantity: 1,
      unitValue: 0,
      icms: bid.globalIcms || 0,
      pis: bid.globalPis || 0,
      cofins: bid.globalCofins || 0,
      ipi: bid.globalIpi || 0,
      iss: bid.globalIss || 0,
      transport: bid.globalTransport || 0,
      warranty: bid.globalWarranty || 0,
      margin: 0,
      createdAt: now,
      updatedAt: now,
    };

    setItems([...items, { id: itemId, ...localItem }]);
    
    // Send to Firestore using proper timestamps
    const newItem = {
        ...localItem,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    }
    
    try {
      await setDoc(doc(db, `bids/${bidId}/items`, itemId), newItem);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `bids/${bidId}/items/${itemId}`);
    }
  };

  const updateItem = async (id: string, field: keyof BidItem, val: string | number) => {
    setItems((prev) => prev.map(item => item.id === id ? { ...item, [field]: val } : item));
  };

  const deleteItemLocally = async (id: string) => {
    setItems((prev) => prev.filter(i => i.id !== id));
    try {
      await deleteDoc(doc(db, `bids/${bidId}/items`, id));
    } catch (error) {
      console.error(error);
    }
  };

  const saveAllItems = async () => {
      setSaving(true);
      try {
         for(const item of items) {
            const itemRef = doc(db, `bids/${bidId}/items`, item.id);
            const { id, createdAt, updatedAt, ...dataToSave } = item;
            const toUpdate = {...dataToSave, updatedAt: serverTimestamp()};
            await updateDoc(itemRef, toUpdate);
         }
         alert("Planilha salva com sucesso!");
      } catch(e) {
          console.error(e);
          alert('Erro ao salvar alguns itens.');
      } finally {
          setSaving(false);
      }
  };

  const calcRow = (item: BidItem) => {
    const valorOriginalTotal = item.quantity * item.unitValue;
    const somatorioPerc = (item.icms + item.pis + item.cofins + item.ipi + item.iss + item.transport + item.warranty + item.margin);
    
    const sumTaxDec = somatorioPerc / 100;
    const isInvalidMarkup = sumTaxDec >= 1;
    const markUp = isInvalidMarkup ? 1 : (1 / (1 - sumTaxDec));
    
    const unitTotal = item.unitValue * markUp;
    const finalTotal = unitTotal * item.quantity;
    
    return {
      valorOriginalTotal,
      somatorioPerc,
      markUp,
      unitTotal,
      finalTotal,
      isInvalidMarkup,
      vIcms: finalTotal * (item.icms / 100),
      vPis: finalTotal * (item.pis / 100),
      vCofins: finalTotal * (item.cofins / 100),
      vIpi: finalTotal * (item.ipi / 100),
      vIss: finalTotal * (item.iss / 100),
      vTrans: finalTotal * (item.transport / 100),
      vGar: finalTotal * (item.warranty / 100),
      vMargin: finalTotal * (item.margin / 100),
    };
  };

  if (loading || !bid) {
    return <div className="p-8 text-center text-gray-600 font-mono">Carregando Planilha...</div>;
  }

  const aggOriginalTotal = items.reduce((acc, item) => acc + (item.quantity * item.unitValue), 0);
  const aggFinalTotal = items.reduce((acc, item) => acc + calcRow(item).finalTotal, 0);

  const aggIcms = items.reduce((acc, item) => acc + calcRow(item).vIcms, 0);
  const aggPis = items.reduce((acc, item) => acc + calcRow(item).vPis, 0);
  const aggCofins = items.reduce((acc, item) => acc + calcRow(item).vCofins, 0);
  const aggIpi = items.reduce((acc, item) => acc + calcRow(item).vIpi, 0);
  const aggIss = items.reduce((acc, item) => acc + calcRow(item).vIss, 0);
  const aggImposto = aggIcms + aggPis + aggCofins + aggIpi + aggIss;
  const aggTrans = items.reduce((acc, item) => acc + calcRow(item).vTrans, 0);
  const aggGar = items.reduce((acc, item) => acc + calcRow(item).vGar, 0);
  const aggMargin = items.reduce((acc, item) => acc + calcRow(item).vMargin, 0);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-gray-900 border-b border-gray-800 p-4 shrink-0 shadow-lg">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div className="flex items-center gap-2">
                <FileSpreadsheet className="text-white h-7 w-7" />
                <Input 
                   value={bid.title} 
                   onChange={(e) => setBid({...bid, title: e.target.value})}
                   onBlur={() => handleUpdateBid('title', bid.title)}
                   className="text-2xl font-bold bg-transparent text-white border-none shadow-none uppercase font-mono px-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-gray-600"
                   placeholder="NOME DA LICITAÇÃO"
                />
            </div>
          </div>
          <div className="flex items-center gap-3">
             <Button variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20 border-0" onClick={addItem}>
               <Plus className="mr-2 h-4 w-4" /> Adicionar Item
             </Button>
             <Button onClick={saveAllItems} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white font-bold tracking-tight border-none">
               <Save className="mr-2 h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar Dados'}
             </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto bg-gray-200 p-4">
          <div className="flex flex-col xl:flex-row gap-6 h-full items-start">
             
             <div className="w-full xl:w-72 shrink-0 flex flex-col gap-6">
                <div className="bg-black text-white rounded-lg p-5 shadow-2xl skew-x-[-2deg] border-b-4 border-red-600 ring-1 ring-white/10">
                   <h2 className="text-3xl font-black italic tracking-tighter mb-1 uppercase">Formação</h2>
                   <h2 className="text-4xl font-black italic tracking-tighter text-red-600 leading-none">DE PREÇO</h2>
                </div>

                <div className="bg-white rounded shadow border border-gray-300 p-0 overflow-hidden">
                    <div className="bg-black text-white text-xs font-bold px-3 py-2 uppercase text-center tracking-widest">Variáveis Globais (%)</div>
                    <div className="divide-y divide-gray-200">
                      {[
                        { label: 'Transporte', key: 'globalTransport' },
                        { label: 'Garantia', key: 'globalWarranty' },
                      ].map(field => (
                         <div key={field.key} className="flex justify-between items-center px-3 py-2 bg-gray-50">
                            <span className="text-xs font-bold text-gray-700">{field.label}</span>
                            <div className="relative">
                              <Input 
                                  type="number" 
                                  className="w-20 text-right pr-6 h-8 text-sm font-mono font-bold" 
                                  value={bid[field.key as keyof Bid]} 
                                  onChange={(e) => handleUpdateBid(field.key as keyof Bid, Number(e.target.value))}
                              />
                              <span className="absolute right-2 top-[6px] text-xs font-bold text-gray-400 pointer-events-none">%</span>
                            </div>
                         </div>
                      ))}
                      
                      <div className="bg-black text-white text-xs font-bold px-3 py-2 uppercase text-center tracking-widest border-t-4 border-gray-900">Impostos Globais</div>
                      {[
                        { label: 'ICMS/Simples', key: 'globalIcms' },
                        { label: 'PIS', key: 'globalPis' },
                        { label: 'COFINS', key: 'globalCofins' },
                        { label: 'IPI', key: 'globalIpi' },
                        { label: 'ISS', key: 'globalIss' },
                      ].map(field => (
                         <div key={field.key} className="flex justify-between items-center px-3 py-2">
                            <span className="text-xs font-bold text-gray-700">{field.label}</span>
                            <div className="relative">
                              <Input 
                                  type="number" 
                                  className="w-20 text-right pr-6 h-8 text-sm font-mono font-bold text-blue-800 pb-0" 
                                  value={bid[field.key as keyof Bid]} 
                                  onChange={(e) => handleUpdateBid(field.key as keyof Bid, Number(e.target.value))}
                              />
                              <span className="absolute right-2 top-[6px] text-xs font-bold text-blue-800 pointer-events-none">%</span>
                            </div>
                         </div>
                      ))}
                    </div>
                </div>
             </div>

             <div className="flex-1 overflow-x-auto bg-white rounded-md shadow-lg border border-gray-400">
               <div className="min-w-max pb-32">
                 <div className="flex bg-gray-300 border-b-2 border-black sticky top-0 z-10 text-[11px] font-bold items-end text-center uppercase tracking-tighter divide-x divide-gray-400 shadow-sm leading-tight">
                    <div className="w-12 shrink-0 bg-gray-400 p-2 border-r border-black flex items-center justify-center">#</div>
                    <div className="w-64 shrink-0 p-2 text-left">Fabricante / Item</div>
                    <div className="w-20 shrink-0 p-2">Qtd</div>
                    <div className="w-32 shrink-0 p-2 text-right">Vlr. Unitário</div>
                    <div className="w-32 shrink-0 p-2 bg-gray-200 text-right">Vlr. Total Dir.</div>
                    
                    <div className="w-16 shrink-0 p-2 bg-pink-100">ICMS<br/>Simp</div>
                    <div className="w-16 shrink-0 p-2 bg-pink-100">PIS</div>
                    <div className="w-16 shrink-0 p-2 bg-pink-100">COFINS</div>
                    <div className="w-16 shrink-0 p-2 bg-pink-100">IPI</div>
                    <div className="w-16 shrink-0 p-2 bg-pink-100">ISS</div>
                    <div className="w-16 shrink-0 p-2 bg-yellow-100">Trans</div>
                    <div className="w-16 shrink-0 p-2 bg-yellow-100">Gar</div>
                    <div className="w-16 shrink-0 p-2 bg-green-100 text-green-800 font-bold">MARG (%)</div>
                    
                    <div className="w-20 shrink-0 p-2 bg-red-100 text-[10px] text-red-800">Soma %<br/>(&lt; 100%)</div>
                    <div className="w-24 shrink-0 p-2 bg-blue-100 text-blue-900">Mark-up</div>
                    <div className="w-32 shrink-0 p-2 bg-blue-600 text-white font-black text-right">Vlr Unit<br/>Final</div>
                    <div className="w-32 shrink-0 p-2 bg-black text-white font-black border-r-4 border-gray-900 text-right">Vlr Total<br/>Final</div>

                    <div className="w-24 shrink-0 p-2 bg-gray-300 border-l border-gray-400">Vlr ICMS/<br/>Simples</div>
                    <div className="w-24 shrink-0 p-2 bg-gray-300">Vlr PIS</div>
                    <div className="w-24 shrink-0 p-2 bg-gray-300">Vlr COFINS</div>
                    <div className="w-24 shrink-0 p-2 bg-gray-300">Vlr IPI</div>
                    <div className="w-24 shrink-0 p-2 bg-gray-300">Vlr ISS</div>
                    <div className="w-24 shrink-0 p-2 bg-gray-400 font-black">Tot Imposto</div>
                    <div className="w-24 shrink-0 p-2 bg-gray-300">Vlr Transp</div>
                    <div className="w-24 shrink-0 p-2 bg-gray-300">Vlr Garantia</div>
                    <div className="w-24 shrink-0 p-2 bg-gray-300">Vlr Margem</div>
                 </div>

                 <div className="divide-y divide-gray-300">
                    {items.map((item, index) => {
                       const c = calcRow(item);
                       return (
                         <div key={item.id} className="flex divide-x divide-gray-300 hover:bg-gray-50 items-center text-sm group">
                            <div className="w-12 shrink-0 text-center text-gray-400 font-mono text-xs flex justify-center px-1">
                               <Button variant="ghost" className="h-6 w-6 p-0 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteItemLocally(item.id)}>
                                 <Trash2 className="h-3 w-3" />
                               </Button>
                               <span className="group-hover:hidden">{index + 1}</span>
                            </div>
                            <div className="w-64 shrink-0"><Input className="h-8 border-none rounded-none w-full text-xs uppercase shadow-none focus-visible:ring-1" value={item.manufacturer} onChange={e => updateItem(item.id, 'manufacturer', e.target.value)} /></div>
                            <div className="w-20 shrink-0"><Input className="h-8 border-none shadow-none focus-visible:ring-1 bg-blue-50/50 rounded-none w-full text-center font-mono font-bold" type="number" value={item.quantity} onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))} /></div>
                            <div className="w-32 shrink-0"><Input className="h-8 border-none shadow-none focus-visible:ring-1 bg-green-50/50 rounded-none w-full text-right font-mono" type="number" value={item.unitValue} onChange={e => updateItem(item.id, 'unitValue', Number(e.target.value))} /></div>
                            <div className="w-32 shrink-0 text-right px-3 text-gray-500 font-mono">R$ {c.valorOriginalTotal.toFixed(2)}</div>

                            <div className="w-16 shrink-0 relative"><Input className="h-8 border-none shadow-none focus-visible:ring-1 rounded-none text-center pr-4 text-xs font-mono" type="number" value={item.icms} onChange={e => updateItem(item.id, 'icms', Number(e.target.value))} /><span className="absolute right-1 top-2 text-[10px] text-gray-400 pointer-events-none">%</span></div>
                            <div className="w-16 shrink-0 relative"><Input className="h-8 border-none shadow-none focus-visible:ring-1 rounded-none text-center pr-4 text-xs font-mono" type="number" value={item.pis} onChange={e => updateItem(item.id, 'pis', Number(e.target.value))} /><span className="absolute right-1 top-2 text-[10px] text-gray-400 pointer-events-none">%</span></div>
                            <div className="w-16 shrink-0 relative"><Input className="h-8 border-none shadow-none focus-visible:ring-1 rounded-none text-center pr-4 text-xs font-mono" type="number" value={item.cofins} onChange={e => updateItem(item.id, 'cofins', Number(e.target.value))} /><span className="absolute right-1 top-2 text-[10px] text-gray-400 pointer-events-none">%</span></div>
                            <div className="w-16 shrink-0 relative"><Input className="h-8 border-none shadow-none focus-visible:ring-1 rounded-none text-center pr-4 text-xs font-mono" type="number" value={item.ipi} onChange={e => updateItem(item.id, 'ipi', Number(e.target.value))} /><span className="absolute right-1 top-2 text-[10px] text-gray-400 pointer-events-none">%</span></div>
                            <div className="w-16 shrink-0 relative"><Input className="h-8 border-none shadow-none focus-visible:ring-1 rounded-none text-center pr-4 text-xs font-mono" type="number" value={item.iss} onChange={e => updateItem(item.id, 'iss', Number(e.target.value))} /><span className="absolute right-1 top-2 text-[10px] text-gray-400 pointer-events-none">%</span></div>
                            
                            <div className="w-16 shrink-0 relative"><Input className="h-8 border-none shadow-none focus-visible:ring-1 rounded-none text-center bg-gray-50 pr-4 text-xs font-mono" type="number" value={item.transport} onChange={e => updateItem(item.id, 'transport', Number(e.target.value))} /><span className="absolute right-1 top-2 text-[10px] text-gray-400 pointer-events-none">%</span></div>
                            <div className="w-16 shrink-0 relative"><Input className="h-8 border-none shadow-none focus-visible:ring-1 rounded-none text-center bg-gray-50 pr-4 text-xs font-mono" type="number" value={item.warranty} onChange={e => updateItem(item.id, 'warranty', Number(e.target.value))} /><span className="absolute right-1 top-2 text-[10px] text-gray-400 pointer-events-none">%</span></div>
                            
                            <div className="w-16 shrink-0 relative"><Input className="h-8 border-none shadow-none focus-visible:ring-1 rounded-none text-center bg-green-50 pr-4 text-xs font-mono font-bold text-green-700" type="number" value={item.margin} onChange={e => updateItem(item.id, 'margin', Number(e.target.value))} /><span className="absolute right-1 top-2 text-[10px] text-green-600 font-bold pointer-events-none">%</span></div>

                            <div className={`w-20 shrink-0 text-center text-[10px] font-bold font-mono px-2 py-2 flex items-center justify-center ${c.isInvalidMarkup ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-800'}`}>
                               {c.somatorioPerc.toFixed(2)}%
                            </div>
                            <div className="w-24 shrink-0 text-center text-xs font-mono px-2 py-2 flex items-center justify-center bg-blue-50 text-blue-900 border-r border-gray-300">
                               {c.markUp.toFixed(5)}
                            </div>
                            
                            <div className="w-32 shrink-0 text-right px-3 py-2 font-mono font-bold text-gray-900 bg-blue-100/50 flex items-center justify-end">
                               R$ {c.unitTotal.toFixed(2)}
                            </div>
                            <div className="w-32 shrink-0 text-right px-3 py-2 font-mono font-black text-gray-900 bg-gray-100 border-r-4 border-gray-900 flex items-center justify-end">
                               R$ {c.finalTotal.toFixed(2)}
                            </div>

                            <div className="w-24 shrink-0 text-right px-2 py-2 font-mono text-xs border-l border-gray-300">R$ {c.vIcms.toFixed(2)}</div>
                            <div className="w-24 shrink-0 text-right px-2 py-2 font-mono text-xs">R$ {c.vPis.toFixed(2)}</div>
                            <div className="w-24 shrink-0 text-right px-2 py-2 font-mono text-xs">R$ {c.vCofins.toFixed(2)}</div>
                            <div className="w-24 shrink-0 text-right px-2 py-2 font-mono text-xs">R$ {c.vIpi.toFixed(2)}</div>
                            <div className="w-24 shrink-0 text-right px-2 py-2 font-mono text-xs">R$ {c.vIss.toFixed(2)}</div>
                            <div className="w-24 shrink-0 text-right px-2 py-2 font-mono text-xs font-bold bg-gray-200">R$ {(c.vIcms + c.vPis + c.vCofins + c.vIpi + c.vIss).toFixed(2)}</div>
                            <div className="w-24 shrink-0 text-right px-2 py-2 font-mono text-xs">R$ {c.vTrans.toFixed(2)}</div>
                            <div className="w-24 shrink-0 text-right px-2 py-2 font-mono text-xs">R$ {c.vGar.toFixed(2)}</div>
                            <div className="w-24 shrink-0 text-right px-2 py-2 font-mono text-xs font-bold text-gray-700 bg-green-50">R$ {c.vMargin.toFixed(2)}</div>
                         </div>
                       )
                    })}

                    {items.length > 0 && (
                      <div className="flex bg-gray-800 text-white font-bold items-center text-[11px] shadow-inner uppercase tracking-wide">
                        <div className="w-12 shrink-0"></div>
                        <div className="w-64 shrink-0 text-right px-4">TOTAL GERAL</div>
                        <div className="w-20 shrink-0"></div>
                        <div className="w-32 shrink-0"></div>
                        <div className="w-32 shrink-0 text-right px-3 text-gray-400 font-mono text-sm py-3">R$ {aggOriginalTotal.toFixed(2)}</div>
                        
                        <div className="w-16 shrink-0"></div>
                        <div className="w-16 shrink-0"></div>
                        <div className="w-16 shrink-0"></div>
                        <div className="w-16 shrink-0"></div>
                        <div className="w-16 shrink-0"></div>
                        <div className="w-16 shrink-0"></div>
                        <div className="w-16 shrink-0"></div>
                        <div className="w-16 shrink-0"></div>
                        
                        <div className="w-20 shrink-0"></div>
                        <div className="w-24 shrink-0"></div>
                        
                        <div className="w-32 shrink-0"></div>
                        <div className="w-32 shrink-0 text-right px-3 text-green-400 text-base font-black font-mono border-r-4 border-gray-900">R$ {aggFinalTotal.toFixed(2)}</div>
                        
                        <div className="w-24 shrink-0 text-right px-2 font-mono py-3">R$ {aggIcms.toFixed(2)}</div>
                        <div className="w-24 shrink-0 text-right px-2 font-mono">R$ {aggPis.toFixed(2)}</div>
                        <div className="w-24 shrink-0 text-right px-2 font-mono">R$ {aggCofins.toFixed(2)}</div>
                        <div className="w-24 shrink-0 text-right px-2 font-mono">R$ {aggIpi.toFixed(2)}</div>
                        <div className="w-24 shrink-0 text-right px-2 font-mono">R$ {aggIss.toFixed(2)}</div>
                        <div className="w-24 shrink-0 text-right px-2 font-mono font-bold text-white bg-gray-700 py-3">R$ {aggImposto.toFixed(2)}</div>
                        <div className="w-24 shrink-0 text-right px-2 font-mono">R$ {aggTrans.toFixed(2)}</div>
                        <div className="w-24 shrink-0 text-right px-2 font-mono">R$ {aggGar.toFixed(2)}</div>
                        <div className="w-24 shrink-0 text-right px-2 font-mono font-bold text-green-400 py-3">R$ {aggMargin.toFixed(2)}</div>
                      </div>
                    )}
                 </div>
               </div>
             </div>
          </div>
      </div>
      
      <div className="bg-gray-100 p-2 text-center text-[10px] text-gray-500 font-mono border-t border-gray-300 uppercase tracking-widest shrink-0">
          Planilha de Formação de Preço - JR 
      </div>
    </div>
  );
}
