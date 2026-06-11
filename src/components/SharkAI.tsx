import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, type Property } from "@/data/mockData";
import {
  X,
  Send,
  MapPin,
  BedDouble,
  Ruler,
  Waves,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface SharkAIProps {
  properties: Property[];
  onSelectProperty?: (property: Property) => void;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  matchedProperties?: Property[];
}

export function SharkAI({ properties, onSelectProperty }: SharkAIProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "🦈 Fala, parceiro! Eu sou o **SHARK**, o tubarão mais agressivo do mercado imobiliário! 🌊\n\nEu mergulho fundo pra encontrar o imóvel ideal e também sei TUDO sobre o mercado:\n\n• *\"Quero 2 quartos, vista mar, até 800 mil\"*\n• *\"Qual o INCC acumulado do ano?\"*\n• *\"Como funciona financiamento com IPCA?\"*\n• *\"Casa em Xangri-lá que aceite permuta\"*\n• *\"Quanto pago de ITBI em um imóvel de 500 mil?\"*",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!query.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: query,
    };
    setMessages((prev) => [...prev, userMessage]);
    setQuery("");
    setIsLoading(true);

    try {
      // Send simplified property data to AI
      const propertyData = properties.map((p) => ({
        id: p.id,
        title: p.title,
        city: p.city,
        type: p.type,
        status: p.status,
        price: p.price,
        area: p.area,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        parking: p.parking,
        decorated: p.decorated,
        seaView: p.seaView,
        acceptsExchange: p.acceptsExchange,
        paymentConditions: p.paymentConditions,
        empreendimento: p.empreendimento,
        address: p.address,
        broker: p.broker,
      }));

      const { data, error } = await supabase.functions.invoke("shark-ai", {
        body: { query: query, properties: propertyData },
      });

      if (error) throw error;

      const matchedProperties = (data.matchedIds || [])
        .map((id: string) => properties.find((p) => p.id === id))
        .filter(Boolean) as Property[];

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.explanation || "🦈 Não encontrei resultados.",
        matchedProperties,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error("Shark AI error:", err);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "🦈 Ops! Tive um problema ao buscar. Tente novamente em instantes! 🌊",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Shark Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0, y: 20 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-24 left-6 z-50 w-16 h-16 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 shadow-2xl flex items-center justify-center hover:shadow-sky-400/40 transition-shadow overflow-hidden border-2 border-sky-300/60"
          >
            <motion.span
              aria-label="Shark AI"
              role="img"
              className="text-3xl"
              animate={{ y: [0, -6, 0], rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, ease: "easeInOut", repeat: Infinity, repeatDelay: 58 }}
            >
              🦈
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.8 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-6 left-6 z-50 w-[400px] max-w-[calc(100vw-48px)] h-[600px] max-h-[calc(100vh-80px)] flex flex-col rounded-3xl shadow-2xl overflow-hidden border border-cyan-200/50"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-cyan-600 via-blue-700 to-cyan-800 px-5 py-4 flex items-center justify-between relative overflow-hidden">
              {/* Water wave decoration */}
              <div className="absolute bottom-0 left-0 right-0 h-4 opacity-20">
                <svg viewBox="0 0 400 16" className="w-full h-full">
                  <path
                    d="M0,8 Q25,0 50,8 T100,8 T150,8 T200,8 T250,8 T300,8 T350,8 T400,8 V16 H0 Z"
                    fill="white"
                  />
                </svg>
              </div>
              <div className="flex items-center gap-3 z-10">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-cyan-300/30">
                  <span role="img" aria-label="Shark" className="text-2xl">🦈</span>
                </div>
                <div>
                  <h3 className="text-white font-extrabold text-lg leading-tight">
                    SHARK AI
                  </h3>
                  <p className="text-cyan-200 text-[11px] font-medium">
                    Imóveis & Mercado Imobiliário
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="z-10 p-2 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-md"
                        : "bg-white shadow-md border border-gray-100 text-gray-800 rounded-bl-md"
                    )}
                  >
                    {/* Render markdown-like bold and italic */}
                    {msg.content.split("\n").map((line, i) => (
                      <p key={i} className={i > 0 ? "mt-1.5" : ""}>
                        {line
                          .replace(
                            /\*\*(.*?)\*\*/g,
                            '<strong class="font-bold">$1</strong>'
                          )
                          .replace(
                            /\*(.*?)\*/g,
                            '<em class="italic text-gray-600">$1</em>'
                          )
                          .split(/(<[^>]+>[^<]*<\/[^>]+>)/)
                          .map((part, j) => {
                            if (part.startsWith("<strong")) {
                              const text = part.replace(/<\/?strong[^>]*>/g, "");
                              return (
                                <strong key={j} className="font-bold">
                                  {text}
                                </strong>
                              );
                            }
                            if (part.startsWith("<em")) {
                              const text = part.replace(/<\/?em[^>]*>/g, "");
                              return (
                                <em key={j} className="italic text-gray-500">
                                  {text}
                                </em>
                              );
                            }
                            return <span key={j}>{part}</span>;
                          })}
                      </p>
                    ))}

                    {/* Property Results */}
                    {msg.matchedProperties && msg.matchedProperties.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {msg.matchedProperties.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => onSelectProperty?.(p)}
                            className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200/50 hover:border-cyan-400 hover:shadow-md transition-all text-left"
                          >
                            <img
                              src={p.image}
                              alt={p.title}
                              className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-900 truncate">
                                {p.title}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500">
                                <span className="flex items-center gap-0.5">
                                  <MapPin className="w-3 h-3" />
                                  {p.city}
                                </span>
                                {p.bedrooms > 0 && (
                                  <span className="flex items-center gap-0.5">
                                    <BedDouble className="w-3 h-3" />
                                    {p.bedrooms}
                                  </span>
                                )}
                                <span className="flex items-center gap-0.5">
                                  <Ruler className="w-3 h-3" />
                                  {p.area}m²
                                </span>
                                {p.seaView && (
                                  <span className="flex items-center gap-0.5 text-blue-500">
                                    <Waves className="w-3 h-3" />
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-extrabold text-cyan-700 mt-0.5">
                                {formatCurrency(p.price)}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white shadow-md border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-600" />
                    <span className="text-sm text-gray-500">
                      🦈 Mergulhando nas opções...
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="bg-white border-t border-gray-100 p-3">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="Ex: 2 quartos, vista mar, até 800 mil..."
                  className="flex-1 px-4 py-3 rounded-2xl bg-gray-100 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:bg-white transition-all"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSubmit}
                  disabled={!query.trim() || isLoading}
                  className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center transition-all flex-shrink-0",
                    query.trim() && !isLoading
                      ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md hover:shadow-lg hover:scale-105"
                      : "bg-gray-200 text-gray-400"
                  )}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
