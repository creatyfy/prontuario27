
import React, { useState, useEffect } from 'react';
import { UserAccount } from '../types';

interface LoginProps {
  onLogin: (user: UserAccount) => void;
  users: UserAccount[];
}

const Login: React.FC<LoginProps> = ({ onLogin, users }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<'empty' | 'invalid' | null>(null);
  const [loading, setLoading] = useState(false);

  // Carregar dados salvos ao iniciar
  useEffect(() => {
    const saved = localStorage.getItem('neuroclinic_remembered');
    if (saved) {
      try {
        const { u, p } = JSON.parse(atob(saved));
        setUsername(u);
        setPassword(p);
        setRemember(true);
      } catch (e) {
        localStorage.removeItem('neuroclinic_remembered');
      }
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError('empty');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      // Verificação da conta mestre Super Admin
      if (username === 'Neuroclinicpro' && password === 'Mexico.15') {
        const masterUser: UserAccount = {
          id: 'master',
          name: 'Gestor Mestre',
          username: 'Neuroclinicpro',
          role: 'admin',
          password: 'Mexico.15',
          isMaster: true
        };
        handleSuccess(masterUser);
        return;
      }

      const user = users.find(u => u.username === username && u.password === password);
      
      if (user) {
        handleSuccess(user);
      } else {
        setError('invalid');
        setLoading(false);
      }
    }, 800);
  };

  const handleSuccess = (user: UserAccount) => {
    if (remember) {
      const data = btoa(JSON.stringify({ u: username, p: password }));
      localStorage.setItem('neuroclinic_remembered', data);
    } else {
      localStorage.removeItem('neuroclinic_remembered');
    }
    onLogin(user);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-md bg-white rounded-[40px] p-10 shadow-2xl animate-in zoom-in-95 duration-500 border border-slate-800/10">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-20 h-20 bg-indigo-600 rounded-[30px] flex items-center justify-center text-white shadow-xl shadow-indigo-200 mb-6">
            <i className="fa-solid fa-brain text-4xl"></i>
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter">NeuroClinic Pro</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-2">Acesso Seguro ao Consultório</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase ml-2 mb-2 tracking-widest">
                Usuário (Login)
              </label>
              <input 
                type="text" 
                disabled={loading}
                className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white transition-all font-bold text-slate-800 outline-none"
                placeholder="ex: dr.omar"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase ml-2 mb-2 tracking-widest">
                Senha
              </label>
              <input 
                type="password" 
                disabled={loading}
                className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white transition-all font-bold text-slate-800 outline-none"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 ml-2">
            <label className="relative flex items-center cursor-pointer group">
              <input 
                type="checkbox" 
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-5 h-5 bg-slate-100 border-2 border-slate-200 rounded-md peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all"></div>
              <i className="fa-solid fa-check absolute left-1 text-[10px] text-white opacity-0 peer-checked:opacity-100 transition-opacity"></i>
              <span className="ml-2 text-[11px] font-bold text-slate-500 group-hover:text-slate-700 transition-colors">Manter conectado neste computador</span>
            </label>
          </div>

          {error && (
            <p className="text-red-500 text-[10px] font-black uppercase text-center tracking-tighter animate-bounce">
              {error === 'empty' ? 'Preencha todos os campos' : 'Usuário ou senha incorretos'}
            </p>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'ENTRAR'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
