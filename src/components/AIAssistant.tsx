import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, X, Loader2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GoogleGenAI } from "@google/genai";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';

interface AIAssistantProps {
  dataContext: any;
  last7Days: any[];
  products: any[];
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ dataContext, last7Days, products }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chat, isLoading]);

  const handleQuery = async () => {
    if (!message.trim()) return;

    const userMsg = message;
    setChat(prev => [...prev, { role: 'user', text: userMsg }]);
    setMessage('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `
        You are an AI Store Manager assistant for "Retail Management Store".
        Below is the current store data:
        ${JSON.stringify(dataContext, null, 2)}

        The admin is asking: "${userMsg}"
        
        Analyze the data and provide a helpful, data-driven answer.
        
        FORMATTING RULES:
        1. Use Markdown for formatting. Use tables for listing multiple items (like products, orders, or sales).
        2. Use bold text for key metrics.
        3. If the user asks about "today's sales", "sales performance", or "revenue trends", include the special tag [SHOW_SALES_CHART] at the end of your response.
        4. If the user asks about "inventory status" or "stock levels", include the special tag [SHOW_INVENTORY_CHART] at the end of your response.
        5. Be professional and concise, but thorough when data is requested.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setChat(prev => [...prev, { role: 'ai', text: response.text || "I'm sorry, I couldn't process that." }]);
    } catch (error) {
      console.error('AI Error:', error);
      toast.error('AI Assistant failed to respond');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-[100]">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-[#0c831f] rounded-full shadow-2xl flex items-center justify-center text-white relative group"
      >
        <div className="absolute inset-0 bg-[#0c831f] rounded-full animate-ping opacity-20 group-hover:animate-none" />
        <MessageSquare size={32} />
        <div className="absolute -top-2 -right-2 bg-green-500 w-5 h-5 rounded-full border-4 border-white" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="absolute bottom-20 right-0 w-[calc(100vw-40px)] md:w-[400px] bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-120px)] md:h-[600px]"
          >
            <div className="p-4 bg-[#0c831f] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Sparkles size={20} />
                </div>
                <div>
                  <p className="font-black text-sm">AI Assistant</p>
                  <p className="text-[10px] font-bold opacity-80">Always here to help</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-2 rounded-lg transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {chat.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                  <MessageSquare size={48} className="mb-4" />
                  <p className="font-black text-sm">Ask me about sales, stock, or any store data!</p>
                </div>
              )}
              {chat.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[95%] p-3 rounded-2xl text-xs font-medium ${
                    msg.role === 'user' 
                      ? 'bg-[#0c831f] text-white rounded-tr-none shadow-md' 
                      : 'bg-white text-gray-800 rounded-tl-none shadow-sm border border-gray-100'
                  }`}>
                    <div className="prose prose-xs max-w-none prose-p:leading-normal prose-table:text-[10px] prose-table:border-collapse prose-td:p-1 prose-td:border prose-td:border-gray-100">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.text.replace(/\[SHOW_SALES_CHART\]|\[SHOW_INVENTORY_CHART\]/g, '')}
                      </ReactMarkdown>
                    </div>
                    
                    {msg.role === 'ai' && msg.text.includes('[SHOW_SALES_CHART]') && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-xl h-[200px] border border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Sales Trend (Last 7 Days)</p>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={last7Days}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                            <XAxis dataKey="name" fontSize={8} tickLine={false} axisLine={false} />
                            <YAxis fontSize={8} tickLine={false} axisLine={false} />
                            <Tooltip 
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }}
                            />
                            <Area type="monotone" dataKey="sales" stroke="#0c831f" strokeWidth={2} fill="#0c831f" fillOpacity={0.1} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {msg.role === 'ai' && msg.text.includes('[SHOW_INVENTORY_CHART]') && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-xl h-[200px] border border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Inventory Distribution</p>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'In Stock', value: products.filter(p => p.stock >= 10).length },
                                { name: 'Low Stock', value: products.filter(p => p.stock < 10).length },
                                { name: 'Damaged', value: products.filter(p => (p.damagedCount || 0) > 0).length }
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={60}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              <Cell fill="#00C49F" />
                              <Cell fill="#FFBB28" />
                              <Cell fill="#0c831f" />
                            </Pie>
                            <Tooltip 
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex justify-center gap-3 mt-1">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-[#00C49F]" />
                            <span className="text-[8px] font-bold text-gray-500">Normal</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-[#FFBB28]" />
                            <span className="text-[8px] font-bold text-gray-500">Low</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-[#0c831f]" />
                            <span className="text-[8px] font-bold text-gray-500">Damaged</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 flex items-center gap-2">
                    <Loader2 className="animate-spin text-[#0c831f]" size={14} />
                    <span className="text-[10px] font-bold text-gray-500">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-4 bg-white border-t border-gray-100">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleQuery()}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-50 border-none rounded-xl py-3 px-4 text-xs font-bold outline-none focus:ring-2 focus:ring-[#0c831f]"
                />
                <button
                  onClick={() => handleQuery()}
                  disabled={isLoading || !message.trim()}
                  className="bg-[#0c831f] text-white p-3 rounded-xl shadow-lg shadow-[#0c831f]/20 hover:bg-[#0a6c19] transition-all disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
