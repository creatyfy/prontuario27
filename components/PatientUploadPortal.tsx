
import React, { useState, useRef, useEffect } from 'react';

interface PatientUploadPortalProps {
  patientName: string;
  expires: string;
  clinicName: string;
}

const PatientUploadPortal: React.FC<PatientUploadPortalProps> = ({ patientName, expires, clinicName }) => {
  const [files, setFiles] = useState<{ id: string; file: File; preview: string; type: 'photo' | 'file' }[]>([]);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'expired'>('idle');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const expTime = parseInt(expires);
    if (isNaN(expTime) || Date.now() > expTime) {
      setStatus('expired');
    }
  }, [expires]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      Array.from(selectedFiles).forEach(f => {
        // Fix: Explicitly cast 'f' to File to resolve 'unknown' type error in readAsDataURL
        const file = f as File;
        const reader = new FileReader();
        reader.onloadend = () => {
          setFiles(prev => [...prev, {
            id: `f-${Date.now()}-${Math.random()}`,
            file: file,
            preview: reader.result as string,
            type: 'file'
          }]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      alert("Não foi possível acessar a câmera.");
    }
  };

  const takePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg');
      
      setFiles(prev => [...prev, {
        id: `photo-${Date.now()}`,
        file: new File([], `FOTO_${Date.now()}.jpg`),
        preview: dataUrl,
        type: 'photo'
      }]);
      
      stopCamera();
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(t => t.stop());
    setIsCameraActive(false);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setStatus('uploading');

    // Simulação de upload para o localStorage
    setTimeout(() => {
      const savedFiles = JSON.parse(localStorage.getItem('neuroclinic_files') || '[]');
      const newEntries = files.map(f => ({
        id: f.id,
        type: f.type === 'photo' ? 'photo' : 'file',
        url: f.preview,
        name: f.type === 'photo' ? `Paciente_${patientName}_${Date.now()}.jpg` : f.file.name,
        date: new Date().toLocaleDateString('pt-BR'),
        isPatientUpload: true,
        patientName: patientName,
        status: 'pending'
      }));

      localStorage.setItem('neuroclinic_files', JSON.stringify([...newEntries, ...savedFiles]));
      setStatus('success');
    }, 1500);
  };

  if (status === 'expired') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-[40px] p-10 shadow-xl max-w-md w-full text-center">
          <i className="fa-solid fa-clock-rotate-left text-5xl text-red-400 mb-6"></i>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Link Expirado</h1>
          <p className="text-slate-500 mt-4">Este link de envio de documentos não é mais válido. Solicite um novo link ao seu médico.</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-[40px] p-10 shadow-xl max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
            <i className="fa-solid fa-check"></i>
          </div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Arquivos Enviados!</h1>
          <p className="text-slate-500 mt-4">Seus documentos foram enviados com sucesso para a equipe do {clinicName}.</p>
          <button onClick={() => window.close()} className="mt-8 w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase shadow-lg">Fechar Janela</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-10 flex flex-col">
      <div className="max-w-2xl mx-auto w-full space-y-8">
        <header className="text-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-xl">
            <i className="fa-solid fa-cloud-arrow-up text-2xl"></i>
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">{clinicName}</h1>
          <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1">Portal de Envio de Documentos</p>
          <p className="text-xs text-slate-400 font-bold mt-2">Paciente: {patientName}</p>
        </header>

        <div className="bg-white rounded-[40px] p-6 md:p-8 shadow-sm border border-slate-200">
          <p className="text-sm font-bold text-slate-700 text-center mb-6">Selecione fotos dos seus exames ou utilize a câmera para enviá-los diretamente.</p>
          
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-3 p-6 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
            >
              <i className="fa-solid fa-file-pdf text-3xl text-slate-300 group-hover:text-indigo-500"></i>
              <span className="text-[10px] font-black uppercase text-slate-500">Arquivos / PDF</span>
            </button>
            <button 
              onClick={startCamera}
              className="flex flex-col items-center gap-3 p-6 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 transition-all group"
            >
              <i className="fa-solid fa-camera text-3xl text-slate-300 group-hover:text-emerald-500"></i>
              <span className="text-[10px] font-black uppercase text-slate-500">Usar Câmera</span>
            </button>
          </div>
          <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,.pdf" />
        </div>

        {files.length > 0 && (
          <div className="bg-white rounded-[40px] p-6 md:p-8 shadow-sm border border-slate-200 animate-in slide-in-from-bottom-4">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Arquivos Selecionados ({files.length})</h2>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {files.map(f => (
                <div key={f.id} className="aspect-square bg-slate-50 rounded-2xl relative overflow-hidden group">
                  <img src={f.preview} className="w-full h-full object-cover" />
                  <button onClick={() => setFiles(prev => prev.filter(x => x.id !== f.id))} className="absolute top-1 right-1 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <i className="fa-solid fa-times"></i>
                  </button>
                </div>
              ))}
            </div>
            <button 
              onClick={handleUpload}
              disabled={status === 'uploading'}
              className="mt-8 w-full py-5 bg-indigo-600 text-white rounded-[24px] font-black text-lg uppercase shadow-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3"
            >
              {status === 'uploading' ? (
                <><i className="fa-solid fa-circle-notch fa-spin"></i> Enviando...</>
              ) : (
                <><i className="fa-solid fa-paper-plane"></i> Finalizar e Enviar</>
              )}
            </button>
          </div>
        )}

        {isCameraActive && (
          <div className="fixed inset-0 bg-black z-[100] flex flex-col">
            <video ref={videoRef} autoPlay playsInline className="flex-1 object-contain"></video>
            <div className="p-10 flex justify-around items-center bg-slate-900/50 backdrop-blur-md">
              <button onClick={stopCamera} className="w-14 h-14 rounded-full bg-white/10 text-white border border-white/20"><i className="fa-solid fa-times"></i></button>
              <button onClick={takePhoto} className="w-20 h-20 rounded-full bg-white border-4 border-slate-300 flex items-center justify-center text-slate-900"><i className="fa-solid fa-camera text-3xl"></i></button>
              <div className="w-14 h-14"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientUploadPortal;
