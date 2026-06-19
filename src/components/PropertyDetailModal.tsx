import { useState, useMemo, useRef, useEffect } from "react";
import DOMPurify from "dompurify";
import { Link } from "@/lib/router-shim";
import {
  X, MapPin, BedDouble, Bath, Car, Ruler, Phone, Waves, Paintbrush,
  Building2, ChevronLeft, ChevronRight, ExternalLink, Play, Repeat,
  CreditCard, Navigation, Share2, Heart, Maximize2, Download, Key,
  Pencil, Check, HardDrive, Flame, TrendingUp, Eye, EyeOff, User,
  Sparkles, Loader2, Target, Zap, FileText, MapPinned, DollarSign,
  Gift, Percent, FileCheck, Hash, Scan, AlertTriangle, FolderDown
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency, type Property } from "@/data/mockData";
import { cn, toSlug } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client-any";
import { useAuth } from "@/hooks/useAuth";
import { DraggableFieldGrid, type FieldConfig } from "./DraggableFieldGrid";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PropertyDetailModalProps {
  property: Property | null;
  onClose: () => void;
  allProperties: Property[];
  brokerInfo?: Record<string, { photo: string; whatsapp: string }>;
  onSelectSimilar?: (p: Property) => void;
  onUpdateProperty?: (updated: Property) => void;
  onFilterByTitle?: (title: string) => void;
  onFilterByCondition?: (cond: string) => void;
}

const statusColors: Record<string, string> = {
  "Disponível": "bg-emerald-500 text-white",
  "Vendido": "bg-red-500 text-white",
  "Reservado": "bg-primary/100 text-white",
  "Alugado": "bg-blue-500 text-white",
  "Suspenso": "bg-muted/400 text-white",
};

function StatusSelectWithConfirm({ currentStatus, onConfirm }: { currentStatus: string; onConfirm: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState("");
  const selectRef = useRef<HTMLSelectElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVal = e.target.value;
    if (newVal === currentStatus) return;
    setPendingStatus(newVal);
    setOpen(true);
    // Reset select visually
    if (selectRef.current) selectRef.current.value = currentStatus;
  };

  return (
    <>
      <select
        ref={selectRef}
        defaultValue={currentStatus}
        onChange={handleChange}
        className={cn(
          "px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide flex-shrink-0 cursor-pointer border-0 focus:outline-none focus:ring-2 focus:ring-ring",
          statusColors[currentStatus] || "bg-muted/400 text-white"
        )}
      >
        {(["Disponível", "Vendido", "Reservado", "Alugado", "Suspenso"] as const).map(s => (
          <option key={s} value={s} className="text-foreground bg-card">{s}</option>
        ))}
      </select>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" />
              Confirmar alteração de status
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deseja alterar o status de <strong className="text-foreground">{currentStatus}</strong> para{" "}
              <strong className="text-foreground">{pendingStatus}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => onConfirm(pendingStatus)}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function PropertyDetailModal({ property, onClose, allProperties, brokerInfo, onSelectSimilar, onUpdateProperty, onFilterByTitle, onFilterByCondition }: PropertyDetailModalProps) {
  const { user, isSuperAdmin, isAdminStaff } = useAuth();
  // Edição só liberada no painel do corretor (/imoveis) e somente para dono ou admin.
  // No site público (/site, /corretor/:slug, /construtora/:slug, /, etc.) edição fica bloqueada.
  const isEditableRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/imoveis");
  const isOwner = !!property && !!user?.id && property.userId === user.id;
  const canEdit = isEditableRoute && !!property && (isSuperAdmin || isAdminStaff || isOwner);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [showOwnerPhone, setShowOwnerPhone] = useState(false);
  const [generatingAI, setGeneratingAI] = useState<string | null>(null);
  const [showAIOptions, setShowAIOptions] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [viewingTerm, setViewingTerm] = useState(false);

  // View tracking happens on public pages via trackPropertyView() —
  // not here, otherwise admin/broker management opens would inflate the counter.

  const defaultBlockOrder = ["identificacao", "valor", "proprietario", "caracteristicas"];
  const [blockOrder, setBlockOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("modal-block-order");
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        const missing = defaultBlockOrder.filter(b => !parsed.includes(b));
        return [...parsed.filter(b => defaultBlockOrder.includes(b)), ...missing];
      }
    } catch {}
    return defaultBlockOrder;
  });
  const [dragBlockIdx, setDragBlockIdx] = useState<number | null>(null);
  const [overBlockIdx, setOverBlockIdx] = useState<number | null>(null);

  const handleBlockDragStart = (e: React.DragEvent, idx: number) => {
    setDragBlockIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  };
  const handleBlockDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverBlockIdx(idx);
  };
  const handleBlockDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    if (dragBlockIdx === null || dragBlockIdx === dropIdx) { setDragBlockIdx(null); setOverBlockIdx(null); return; }
    setBlockOrder(prev => {
      const items = [...prev];
      const [moved] = items.splice(dragBlockIdx, 1);
      items.splice(dropIdx, 0, moved);
      localStorage.setItem("modal-block-order", JSON.stringify(items));
      return items;
    });
    setDragBlockIdx(null);
    setOverBlockIdx(null);
  };
  const handleBlockDragEnd = () => { setDragBlockIdx(null); setOverBlockIdx(null); };

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!property) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [property]);

  if (!property) return null;

  const images = property.images && property.images.length > 0 ? property.images : [property.image];
  const unitParts = [property.unitNumber, property.boxNumber, property.quadra, property.lote].filter(Boolean);
  const broker = brokerInfo?.[property.broker];
  const whatsappMessage = encodeURIComponent(`Olá! Tenho interesse no imóvel: ${property.title} - ${formatCurrency(property.price)}`);
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${property.address}, ${property.city}`)}`;
  const videoUrl = property.linkVideo || "";
  const materialUrl = property.linkMaterial || "";
  const link360 = property.link360 || "";
  const driveFotosUrl = property.driveFotosUrl || "";
  const fotosPdfUrl = property.fotosPdfUrl || "";

  // Convert YouTube URL to embed URL
  const getYoutubeEmbedUrl = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return `https://www.youtube.com/embed/${match[1]}`;
    }
    return null;
  };

  const youtubeEmbed = videoUrl ? getYoutubeEmbedUrl(videoUrl) : null;
  const isEmbeddableVideo = !!youtubeEmbed;

  const ownerProperties = allProperties
    .filter((p) => p.id !== property.id && p.owner && property.owner && p.owner === property.owner)
    .slice(0, 6);

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => {
      const next = prev - 2;
      if (next < 0) {
        const lastPair = Math.max(0, (Math.ceil(images.length / 2) - 1) * 2);
        return lastPair;
      }
      return next;
    });
  };
  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => {
      const next = prev + 2;
      return next >= images.length ? 0 : next;
    });
  };

  // -- Inline edit helpers --
  const startEdit = (field: string, currentValue: string | number) => {
    setEditingField(field);
    setEditValues((prev) => ({ ...prev, [field]: String(currentValue) }));
  };

  const saveEdit = (field: string) => {
    if (!onUpdateProperty) {
      toast.info("Edição salva localmente");
    } else {
      const val = editValues[field];
      const updated = { ...property };
      switch (field) {
        case "title": updated.title = val; break;
        case "code": updated.code = val; break;
        case "price": updated.price = Number(val) || property.price; break;
        case "priceInstallment": updated.priceInstallment = Number(val) || 0; break;
        case "address": updated.address = val; break;
        case "city": updated.city = val; break;
        case "neighborhood": updated.neighborhood = val; break;
        case "area": updated.area = Number(val) || property.area; break;
        case "privateArea": updated.privateArea = Number(val) || 0; break;
        case "bedrooms": updated.bedrooms = Number(val) || 0; break;
        case "bathrooms": updated.bathrooms = Number(val) || 0; break;
        case "parking": updated.parking = Number(val) || 0; break;
        case "description": updated.description = val; break;
        case "posicaoPredio": updated.posicaoPredio = val; break;
        case "posicaoSolar": updated.posicaoSolar = val; break;
        case "vista": updated.vista = val; break;
        case "condicao": updated.condicao = val as Property["condicao"]; break;
        case "infraestrutura": updated.infraestrutura = val.split(",").map(s => s.trim()).filter(Boolean); break;
        case "empreendimento": updated.empreendimento = val || undefined; break;
        case "unitNumber": updated.unitNumber = val || undefined; break;
        case "boxNumber": updated.boxNumber = val || undefined; break;
        case "quadra": updated.quadra = val || undefined; break;
        case "lote": updated.lote = val || undefined; break;
        case "keysLocation": updated.keysLocation = val || undefined; break;
        case "exclusivityTerm": updated.exclusivityTerm = val || undefined; break;
        case "owner": updated.owner = val || undefined; break;
        case "ownerPhone": updated.ownerPhone = val || undefined; break;
        case "broker": updated.broker = val; break;
        case "commission": updated.commission = Number(val) || undefined; break;
        case "bonus": updated.bonus = Number(val) || undefined; break;
        case "bonusExpiry": updated.bonusExpiry = val || undefined; break;
      }
      updateProperty(updated);
      toast.success("Informação atualizada!");
    }
    setEditingField(null);
  };

  const cancelEdit = () => setEditingField(null);

  // Wrapper to track changes
  const updateProperty = (updated: Property) => {
    if (onUpdateProperty) {
      onUpdateProperty(updated);
      setHasChanges(true);
    }
  };

  // -- Confirm update (stamp updatedAt) --
  const handleConfirmUpdate = () => {
    if (onUpdateProperty && hasChanges) {
      onUpdateProperty({ ...property, updatedAt: new Date().toISOString() });
      setHasChanges(false);
      toast.success("Imóvel atualizado! Data de atualização registrada.");
    }
  };

  // -- Close with auto-update --
  const handleClose = () => {
    if (hasChanges && onUpdateProperty) {
      onUpdateProperty({ ...property, updatedAt: new Date().toISOString() });
      toast.success("Alterações salvas e data atualizada.");
    }
    onClose();
  };

  // -- AI Description Generation --
  const aiStyles = [
    { id: "gatilhos", label: "Gatilhos de Venda", icon: Target, color: "text-red-500 bg-red-50 border-red-200 hover:bg-red-100" },
    { id: "agressiva", label: "Agressiva (Vendas)", icon: Zap, color: "text-orange-500 bg-orange-50 border-orange-200 hover:bg-orange-100" },
    { id: "informativa", label: "Informativa Completa", icon: FileText, color: "text-blue-500 bg-blue-50 border-blue-200 hover:bg-blue-100" },
    { id: "geolocalizacao", label: "Geolocalização", icon: MapPinned, color: "text-emerald-500 bg-emerald-50 border-emerald-200 hover:bg-emerald-100" },
  ];

  const handleGenerateDescription = async (style: string) => {
    setGeneratingAI(style);
    try {
      const { data, error } = await supabase.functions.invoke("generate-description", {
        body: { property, style },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.description) {
        setEditValues((prev) => ({ ...prev, description: data.description }));
        setEditingField("description");
        setShowAIOptions(false);
        toast.success("Descrição gerada com IA! Revise e salve.");
      }
    } catch (e: any) {
      console.error("AI description error:", e);
      toast.error(e?.message || "Erro ao gerar descrição com IA");
    } finally {
      setGeneratingAI(null);
    }
  };

  // -- Share via WhatsApp --
  const handleShare = async () => {
    const publicUrl = `${window.location.origin}/imovel/${property.id}`;
    const text = `🏠 *${property.title}*\n💰 ${formatCurrency(property.price)}\n📍 ${property.address}, ${property.city}\n🛏 ${property.bedrooms} quartos • 🚿 ${property.bathrooms} banheiros • 📐 ${property.area}m²\n\n🔗 ${publicUrl}`;
    if (navigator.share) {
      try { await navigator.share({ title: property.title, text, url: publicUrl }); return; } catch {}
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  // -- Download fotos como PDF --
  const handleDownload = async () => {
    const imgs = property.images || [];
    if (!imgs.length) {
      toast.info("Este imóvel não possui fotos para baixar.");
      return;
    }
    try {
      toast.loading("Gerando PDF...", { id: "pdf-gen" });
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      // Capa
      pdf.setFontSize(22);
      pdf.text(property.title, pageW / 2, 30, { align: "center" });
      pdf.setFontSize(14);
      pdf.text(formatCurrency(property.price), pageW / 2, 42, { align: "center" });
      pdf.setFontSize(11);
      pdf.text(`${property.address} - ${property.city}`, pageW / 2, 52, { align: "center" });
      pdf.text(`${property.bedrooms} quartos • ${property.bathrooms} banheiros • ${property.area}m²`, pageW / 2, 60, { align: "center" });

      const loadImg = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

      for (const src of imgs) {
        try {
          const img = await loadImg(src);
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext("2d")!.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          const ratio = img.naturalWidth / img.naturalHeight;
          let w = pageW - 20, h = w / ratio;
          if (h > pageH - 20) { h = pageH - 20; w = h * ratio; }
          pdf.addPage();
          pdf.addImage(dataUrl, "JPEG", (pageW - w) / 2, (pageH - h) / 2, w, h);
        } catch { /* skip */ }
      }

      pdf.save(`fotos_${property.title.replace(/\s+/g, "_").toLowerCase()}.pdf`);
      toast.success("PDF gerado com sucesso!", { id: "pdf-gen" });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF", { id: "pdf-gen" });
    }
  };

  // -- Download material completo --
  const handleMaterialDownload = () => {
    if (materialUrl) {
      window.open(materialUrl, "_blank");
      toast.success("Abrindo material completo...");
    } else {
      toast.info("Nenhum link de material cadastrado para este imóvel.");
    }
  };

  // -- Editable field component --
  const EditableField = ({ field, value, label, type = "text", className = "" }: { field: string; value: string | number; label?: string; type?: string; className?: string }) => {
    if (editingField === field) {
      return (
        <div className="flex items-center gap-1.5">
          <input
            type={type}
            value={editValues[field] ?? String(value)}
            onChange={(e) => setEditValues((prev) => ({ ...prev, [field]: e.target.value }))}
            className="bg-card border border-amber-300 rounded px-2 py-1 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring min-w-0"
            style={{ width: Math.max(80, String(editValues[field] ?? value).length * 9) }}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(field); if (e.key === "Escape") cancelEdit(); }}
          />
          <button onClick={() => saveEdit(field)} className="w-6 h-6 rounded bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={cancelEdit} className="w-6 h-6 rounded bg-gray-300 text-muted-foreground flex items-center justify-center hover:bg-gray-400 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }
    return (
      <span className={cn("group/edit inline-flex items-center gap-1 cursor-pointer hover:bg-primary/10 rounded px-1 -mx-1 transition-colors", className)}
        onClick={(e) => { e.stopPropagation(); startEdit(field, value); }}
        title={`Clique para editar ${label || field}`}
      >
        {type === "number" && field === "price" ? formatCurrency(Number(value)) : value}
        <Pencil className="w-3 h-3 text-primary/70 opacity-0 group-hover/edit:opacity-100 transition-opacity flex-shrink-0" />
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-start justify-center overflow-y-auto overflow-x-hidden p-0 sm:p-4 sm:pt-6 sm:pb-8" onClick={handleClose}>
      <div className="bg-card sm:rounded-2xl shadow-2xl w-full max-w-5xl min-h-screen sm:min-h-0 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4 border-b border-border">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h2 className="text-sm sm:text-lg font-bold text-foreground truncate">
              <span
                className="cursor-pointer hover:text-primary transition-colors"
                onClick={() => onFilterByTitle?.(property.title)}
                title="Clique para ver títulos semelhantes"
              >
                <EditableField field="title" value={property.title} label="título" />
              </span>
            </h2>
            {property.code && (
              <span className="text-[10px] sm:text-[11px] font-black text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                <EditableField field="code" value={property.code} label="código" />
              </span>
            )}
            <StatusSelectWithConfirm
              currentStatus={property.status}
              onConfirm={(newStatus) => {
                if (onUpdateProperty) {
                  updateProperty({ ...property, status: newStatus as Property["status"] });
                  toast.success("Status atualizado!");
                }
              }}
            />
          </div>
          {/* Action buttons in header */}
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {canEdit && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link to="/imoveis/$id/editar" params={{ id: property.id }} onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-primary">
                      <Pencil className="w-4.5 h-4.5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent><p>Editar imóvel</p></TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={handleShare} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-primary">
                    <Share2 className="w-4.5 h-4.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent><p>Compartilhar</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={handleDownload} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-blue-600">
                    <Download className="w-4.5 h-4.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent><p>Baixar ficha</p></TooltipContent>
              </Tooltip>
              {materialUrl && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={handleMaterialDownload} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-purple-600">
                      <Download className="w-4.5 h-4.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent><p>Material Completo</p></TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={handleClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent><p>Fechar</p></TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        {/* Main image gallery - 2 imagens quadradas por vez */}
        <div className="relative bg-gray-900">
          <div className="grid grid-cols-2 gap-1">
            <button type="button" onClick={() => setLightboxIndex(currentImageIndex)} className="relative aspect-square bg-gray-800 overflow-hidden group cursor-zoom-in">
              <img src={images[currentImageIndex]} alt={property.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
            </button>
            {images[currentImageIndex + 1] ? (
              <button type="button" onClick={() => setLightboxIndex(currentImageIndex + 1)} className="relative aspect-square bg-gray-800 overflow-hidden group cursor-zoom-in">
                <img src={images[currentImageIndex + 1]} alt={property.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
              </button>
            ) : (
              <div className="relative aspect-square bg-gray-800" />
            )}
          </div>
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/40 via-transparent to-black/20" />

          {images.length > 1 && (
            <>
              <button onClick={prevImage} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/90 hover:bg-card flex items-center justify-center shadow-lg transition-all hover:scale-105">
                <ChevronLeft className="w-5 h-5 text-foreground" />
              </button>
              <button onClick={nextImage} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/90 hover:bg-card flex items-center justify-center shadow-lg transition-all hover:scale-105">
                <ChevronRight className="w-5 h-5 text-foreground" />
              </button>
            </>
          )}

          <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/50 text-white text-xs font-bold backdrop-blur-sm">
            {Math.floor(currentImageIndex / 2) + 1} / {Math.ceil(images.length / 2)}
          </div>

          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
            {property.seaView && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/90 text-white flex items-center gap-1 backdrop-blur-sm">
                <Waves className="w-3 h-3" /> Vista Mar
              </span>
            )}
            {property.decorated && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-500/90 text-white flex items-center gap-1 backdrop-blur-sm">
                <Paintbrush className="w-3 h-3" /> Decorado
              </span>
            )}
            {property.acceptsExchange && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-500/90 text-white flex items-center gap-1 backdrop-blur-sm">
                <Repeat className="w-3 h-3" /> Aceita Permuta
              </span>
            )}
          </div>

          {/* Price - editable */}
          <div className="absolute bottom-3 left-3">
            <p className="text-3xl font-black text-white drop-shadow-lg">
              <EditableField field="price" value={property.price} label="preço" type="number" className="text-white hover:bg-card/20" />
            </p>
          </div>

          {images.length > 2 && (
            <div className="absolute bottom-3 right-3 flex gap-1.5">
              {Array.from({ length: Math.ceil(images.length / 2) }).map((_, i) => {
                const active = Math.floor(currentImageIndex / 2) === i;
                return (
                  <button key={i} onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(i * 2); }}
                    className={cn("w-2.5 h-2.5 rounded-full transition-all", active ? "bg-card w-5" : "bg-card/50 hover:bg-card/80")}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div className="flex gap-1 p-2 bg-muted overflow-x-auto">
            {images.map((img, i) => (
              <button key={i} onClick={() => setCurrentImageIndex(i)}
                className={cn("flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all",
                  i === currentImageIndex ? "border-primary opacity-100" : "border-transparent opacity-60 hover:opacity-90"
                )}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Media: Vídeo + Tour 360° (logo após as fotos) */}
        {(videoUrl || link360) && (
          <div className="px-5 sm:px-6 pt-5 space-y-4">
            {videoUrl && (
              <div className="rounded-xl overflow-hidden border border-border bg-card shadow-sm">
                <button onClick={() => setShowVideo(!showVideo)} className="w-full flex items-center justify-between p-4 bg-muted/40 hover:bg-muted transition-colors">
                  <span className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Play className="w-4 h-4 text-primary fill-primary" />
                    </span>
                    Vídeo do Imóvel
                  </span>
                  <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform", showVideo && "rotate-90")} />
                </button>
                {showVideo && (
                  isEmbeddableVideo ? (
                    <div className="aspect-video bg-foreground">
                      <iframe src={youtubeEmbed!} title="Vídeo do imóvel" className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                    </div>
                  ) : (
                    <div className="p-4">
                      <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline font-medium">
                        <ExternalLink className="w-4 h-4" /> {videoUrl}
                      </a>
                    </div>
                  )
                )}
              </div>
            )}

            {link360 && (
              <div className="rounded-xl overflow-hidden border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between p-4 bg-muted/40">
                  <span className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <span className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Eye className="w-4 h-4 text-accent" />
                    </span>
                    Tour Virtual 360°
                  </span>
                </div>
                {link360.startsWith("<") ? (
                  <div
                    className="aspect-video"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(link360, {
                        ALLOWED_TAGS: ["iframe"],
                        ALLOWED_ATTR: ["src", "width", "height", "allow", "allowfullscreen", "frameborder", "style", "class", "title"],
                      }),
                    }}
                  />
                ) : link360.includes("http") ? (
                  <div className="aspect-video">
                    <iframe src={link360} title="Tour 360°" className="w-full h-full border-0" allowFullScreen />
                  </div>
                ) : (
                  <div className="p-4">
                    <p className="text-sm text-muted-foreground">{link360}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-2 px-5 py-3 bg-primary/5 border-b border-primary/20 flex-wrap">
          <button onClick={handleShare} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors shadow-sm">
            <Share2 className="w-4 h-4 text-primary" /> Compartilhar
          </button>
          {fotosPdfUrl ? (
            <a href={fotosPdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors shadow-sm">
              <Download className="w-4 h-4 text-blue-500" /> Baixar Fotos (PDF)
            </a>
          ) : (
            <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors shadow-sm">
              <Download className="w-4 h-4 text-blue-500" /> Baixar Fotos (PDF)
            </button>
          )}
          {materialUrl && (
            <a href={materialUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors shadow-sm">
              <HardDrive className="w-4 h-4 text-emerald-600" /> Baixar Drive
            </a>
          )}
          {property.exclusivityTermUrl && (
            <button
              onClick={() => setViewingTerm(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors shadow-sm"
            >
              <FileCheck className="w-4 h-4 text-amber-600" /> Exclusividade
            </button>
          )}
          {canEdit && (
            <Link to="/imoveis/$id/editar" params={{ id: property.id }} onClick={onClose} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors shadow-sm">
              <Pencil className="w-4 h-4 text-primary" /> Editar
            </Link>
          )}
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5">

          {/* Empreendimento + Unit Info */}
          {(property.empreendimento || unitParts.length > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              {property.empreendimento && (
                <Link
                  to={`/empreendimento/${property.empreendimento.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`}
                  className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-1.5"
                  onClick={onClose}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  {property.empreendimento}
                </Link>
              )}
              {unitParts.map((part) => (
                <span key={part} className="text-xs font-semibold text-muted-foreground bg-muted px-3 py-1.5 rounded-lg">
                  {part}
                </span>
              ))}
            </div>
          )}

          {/* Location - editable */}
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <MapPin className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0" onClick={(e) => e.preventDefault()}>
              <div className="text-sm font-medium">
                <EditableField field="address" value={property.address} label="endereço" /> ,{" "}
                <EditableField field="city" value={property.city} label="cidade" />
              </div>
              <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                <Navigation className="w-3 h-3" /> Clique para abrir no Google Maps
              </p>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/70 ml-auto flex-shrink-0" />
          </a>

          {/* Specs grid - editable */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-muted/40 rounded-xl p-4 text-center border border-border">
              <Maximize2 className="w-5 h-5 mx-auto text-primary mb-1.5" />
              <p className="text-xl font-bold text-foreground">
                <EditableField field="area" value={property.area} label="área" type="number" />m²
              </p>
              <p className="text-[11px] text-muted-foreground font-medium">Área Total</p>
            </div>
            <div className="bg-muted/40 rounded-xl p-4 text-center border border-border">
              <BedDouble className="w-5 h-5 mx-auto text-primary mb-1.5" />
              <p className="text-xl font-bold text-foreground">
                <EditableField field="bedrooms" value={property.bedrooms} label="quartos" type="number" />
              </p>
              <p className="text-[11px] text-muted-foreground font-medium">Quartos</p>
            </div>
            <div className="bg-muted/40 rounded-xl p-4 text-center border border-border">
              <Bath className="w-5 h-5 mx-auto text-primary mb-1.5" />
              <p className="text-xl font-bold text-foreground">
                <EditableField field="bathrooms" value={property.bathrooms} label="banheiros" type="number" />
              </p>
              <p className="text-[11px] text-muted-foreground font-medium">Banheiros</p>
            </div>
            <div className="bg-muted/40 rounded-xl p-4 text-center border border-border">
              <Car className="w-5 h-5 mx-auto text-primary mb-1.5" />
              <p className="text-xl font-bold text-foreground">
                <EditableField field="parking" value={property.parking} label="vagas" type="number" />
              </p>
              <p className="text-[11px] text-muted-foreground font-medium">Vagas</p>
            </div>
          </div>

          {/* Draggable Content Blocks */}
          {blockOrder.map((blockId, bIdx) => {
            const isDraggingBlock = dragBlockIdx === bIdx;
            const isOverBlock = overBlockIdx === bIdx && dragBlockIdx !== null && dragBlockIdx !== bIdx;

            const blockWrapper = (key: string, content: React.ReactNode) => (
              <div
                key={key}
                draggable
                onDragStart={e => handleBlockDragStart(e, bIdx)}
                onDragOver={e => handleBlockDragOver(e, bIdx)}
                onDrop={e => handleBlockDrop(e, bIdx)}
                onDragEnd={handleBlockDragEnd}
                className={cn(
                  "transition-all duration-150 relative",
                  isDraggingBlock && "opacity-40 scale-[0.98]",
                  isOverBlock && "before:absolute before:inset-x-2 before:top-0 before:h-1 before:bg-amber-400 before:rounded-full before:-translate-y-1"
                )}
              >
                {content}
              </div>
            );

            if (blockId === "identificacao") {
              const isEditing = editingBlock === "identificacao";
              const isEdificio = property.type === "Apartamento" || property.type === "Comercial";

              const idFields: FieldConfig[] = [
                // Row 1: Tipo, Empreendimento, Unidade/Quadra, Box/Lote
                { id: "tipo", label: "Tipo", render: () => isEditing ? (
                  <select value={property.type} onChange={(e) => { if (onUpdateProperty) { updateProperty({ ...property, type: e.target.value as Property["type"] }); toast.success("Tipo atualizado!"); } }} className="w-full px-3 py-2 rounded-lg border border-input text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                    {(["Apartamento", "Casa", "Comercial", "Terreno", "Lote", "Condomínio"] as const).map(t => (<option key={t} value={t}>{t}</option>))}
                  </select>
                ) : <span className="text-sm font-medium text-foreground">{property.type}</span> },
                { id: "empreendimento", label: "Empreendimento", render: () => isEditing ? (
                  <div className="w-full space-y-1.5">
                    <select value={property.empreendimento || ""} onChange={(e) => { if (!onUpdateProperty) return; const selected = e.target.value; if (!selected) { updateProperty({ ...property, empreendimento: undefined }); toast.success("Empreendimento removido"); return; } const ref = allProperties.find(p => p.empreendimento === selected && p.id !== property.id); if (ref) { updateProperty({ ...property, empreendimento: selected, address: ref.address || property.address, city: ref.city || property.city, neighborhood: ref.neighborhood || property.neighborhood, infraestrutura: ref.infraestrutura || property.infraestrutura, posicaoPredio: property.posicaoPredio || ref.posicaoPredio, posicaoSolar: property.posicaoSolar || ref.posicaoSolar }); toast.success(`Dados do empreendimento "${selected}" aplicados!`); } else { updateProperty({ ...property, empreendimento: selected }); toast.success("Empreendimento atualizado!"); } }} className="w-full px-3 py-2 rounded-lg border border-input text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="">Selecione</option>
                      {[...new Set(allProperties.map(p => p.empreendimento).filter(Boolean))].sort().map(emp => (<option key={emp} value={emp}>{emp}</option>))}
                    </select>
                    <input type="text" placeholder="Ou digite um novo..." className="w-full px-3 py-1.5 rounded-lg border border-input text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" onKeyDown={(e) => { if (e.key === "Enter" && onUpdateProperty) { const val = (e.target as HTMLInputElement).value.trim(); if (val) { updateProperty({ ...property, empreendimento: val }); toast.success(`Empreendimento "${val}" definido!`); (e.target as HTMLInputElement).value = ""; } } }} />
                  </div>
                ) : <span className="text-sm font-medium text-foreground">{property.empreendimento || "—"}</span> },
                ...(isEdificio ? [
                  { id: "unidade", label: "Apt / Unidade", render: () => isEditing ? <EditableField field="unitNumber" value={property.unitNumber || ""} label="unidade" /> : <span className="text-sm font-medium text-foreground">{property.unitNumber || "—"}</span> },
                  { id: "box", label: "Box / Vaga", render: () => isEditing ? <EditableField field="boxNumber" value={property.boxNumber || ""} label="box" /> : <span className="text-sm font-medium text-foreground">{property.boxNumber || "—"}</span> },
                ] : [
                  { id: "quadra", label: "Quadra", render: () => isEditing ? <EditableField field="quadra" value={property.quadra || ""} label="quadra" /> : <span className="text-sm font-medium text-foreground">{property.quadra || "—"}</span> },
                  { id: "lote", label: "Lote", render: () => isEditing ? <EditableField field="lote" value={property.lote || ""} label="lote" /> : <span className="text-sm font-medium text-foreground">{property.lote || "—"}</span> },
                ]),
                // Row 2: Dormitórios, Banheiros, Área Privativa, Área Total
                { id: "dormitorios", label: "Dormitórios", render: () => isEditing ? <EditableField field="bedrooms" value={property.bedrooms} label="dormitórios" type="number" /> : <span className="text-sm font-medium text-foreground">{property.bedrooms}</span> },
                { id: "banheiros", label: "Banheiros", render: () => isEditing ? <EditableField field="bathrooms" value={property.bathrooms} label="banheiros" type="number" /> : <span className="text-sm font-medium text-foreground">{property.bathrooms}</span> },
                { id: "areaPriv", label: "Área Privativa", render: () => isEditing ? <span className="flex items-center gap-1"><EditableField field="privateArea" value={property.privateArea || 0} label="área privativa" type="number" /><span className="text-[10px] text-muted-foreground">m²</span></span> : <span className="text-sm font-medium text-foreground">{property.privateArea ? `${property.privateArea} m²` : "—"}</span> },
                { id: "areaTotal", label: "Área Total", render: () => isEditing ? <span className="flex items-center gap-1"><EditableField field="area" value={property.area || 0} label="área total" type="number" /><span className="text-[10px] text-muted-foreground">m²</span></span> : <span className="text-sm font-medium text-foreground">{property.area ? `${property.area} m²` : "—"}</span> },
                // Row 3: Cidade, Bairro, Endereço (2col)
                { id: "cidade", label: "Cidade", render: () => isEditing ? <EditableField field="city" value={property.city || ""} label="cidade" /> : <span className="text-sm font-medium text-foreground">{property.city || "—"}</span> },
                { id: "bairro", label: "Bairro", render: () => isEditing ? <EditableField field="neighborhood" value={property.neighborhood || ""} label="bairro" /> : <span className="text-sm font-medium text-foreground">{property.neighborhood || "—"}</span> },
                { id: "endereco", label: "Endereço", colSpan: 2, render: () => isEditing ? <EditableField field="address" value={property.address || ""} label="endereço" /> : <span className="text-sm font-medium text-foreground">{property.address || "—"}</span> },
              ];

              return blockWrapper("identificacao",
                <div className="bg-card rounded-2xl p-5 border border-border/60 shadow-[0_2px_8px_-2px_hsl(var(--foreground)/0.06)] hover:shadow-[0_8px_24px_-8px_hsl(var(--foreground)/0.12)] transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <span className="cursor-grab active:cursor-grabbing mr-1 text-muted-foreground/50 hover:text-muted-foreground">⠿</span>
                      <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><Hash className="w-3.5 h-3.5 text-primary" /></span> <span className="text-foreground">Identificação</span>
                    </p>
                    <button onClick={() => setEditingBlock(isEditing ? null : "identificacao")} className={cn("p-1.5 rounded-lg transition-colors", isEditing ? "bg-primary/20 text-primary" : "hover:bg-muted text-muted-foreground")}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <DraggableFieldGrid storageKey="fields-identificacao" fields={idFields} columns={4} editing={isEditing} />
                </div>
              );
            }

            if (blockId === "valor") {
              const isEditingValor = editingBlock === "valor";
              const valorFields: FieldConfig[] = [
                { id: "price", label: "Valor do Imóvel", render: () => isEditingValor ? <span className="flex items-center gap-1"><span className="text-sm font-bold text-muted-foreground">R$</span><EditableField field="price" value={property.price} label="valor" type="number" /></span> : <span className="text-sm font-bold text-foreground">{formatCurrency(property.price)}</span> },
                { id: "priceInstallment", label: "Valor Promocional", render: () => isEditingValor ? <span className="flex items-center gap-1"><span className="text-sm font-bold text-muted-foreground">R$</span><EditableField field="priceInstallment" value={property.priceInstallment || 0} label="valor promocional" type="number" /></span> : <span className="text-sm font-medium text-foreground">{property.priceInstallment ? formatCurrency(property.priceInstallment) : "—"}</span> },
                { id: "commission", label: "Comissão (%)", render: () => isEditingValor ? <EditableField field="commission" value={property.commission || 0} label="comissão" type="number" /> : <span className="text-sm font-medium text-foreground">{property.commission ? `${property.commission}%` : "—"}</span> },
                { id: "commissionValue", label: "Valor Comissão", render: () => <span className="text-sm font-semibold text-emerald-700">{formatCurrency(property.price * (property.commission || 0) / 100)}</span> },
                { id: "bonus", label: "Bônus", render: () => isEditingValor ? <span className="flex items-center gap-1"><span className="text-sm font-bold text-muted-foreground">R$</span><EditableField field="bonus" value={property.bonus || 0} label="bônus" type="number" /></span> : <span className="text-sm font-medium text-foreground">{property.bonus ? formatCurrency(property.bonus) : "—"}</span> },
                { id: "bonusExpiry", label: "Validade Bônus", render: () => isEditingValor ? <EditableField field="bonusExpiry" value={property.bonusExpiry || ""} label="validade bônus" /> : <span className="text-sm font-medium text-foreground">{property.bonusExpiry || "—"}</span> },
              ];

              return blockWrapper("valor",
                <div className="bg-card rounded-2xl p-5 border border-border/60 shadow-[0_2px_8px_-2px_hsl(var(--foreground)/0.06)] hover:shadow-[0_8px_24px_-8px_hsl(var(--foreground)/0.12)] transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <span className="cursor-grab active:cursor-grabbing mr-1 text-muted-foreground/50 hover:text-muted-foreground">⠿</span>
                      <span className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center"><DollarSign className="w-3.5 h-3.5 text-emerald-600" /></span> <span className="text-foreground">Valor e Condições</span>
                    </p>
                    <button onClick={() => setEditingBlock(isEditingValor ? null : "valor")} className={cn("p-1.5 rounded-lg transition-colors", isEditingValor ? "bg-primary/20 text-primary" : "hover:bg-muted text-muted-foreground")}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <DraggableFieldGrid storageKey="fields-valor" fields={valorFields} editing={isEditingValor} />

                  {isEditingValor && (
                    <>
                      <div className="mt-4 pt-4 border-t border-border">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block flex items-center gap-1">
                          <CreditCard className="w-3 h-3" /> Condições de Pagamento
                        </label>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Parcelamento Direto</p>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {["12x", "24x", "36x", "48x", "60x", "72x", "84x", "100x", "120x"].map((cond) => {
                            const isActive = property.paymentConditions?.includes(cond);
                            return (
                              <button key={cond} onClick={() => { if (!onUpdateProperty) return; const current = property.paymentConditions || []; const updated = isActive ? current.filter(c => c !== cond) : [...current, cond]; updateProperty({ ...property, paymentConditions: updated }); toast.success(isActive ? `"${cond}" removido` : `"${cond}" adicionado`); }}
                                className={cn("px-3 py-1.5 rounded-lg text-xs font-bold border transition-all", isActive ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-background text-muted-foreground border-border hover:bg-muted")}>{cond}</button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Outras Condições</p>
                        <div className="flex flex-wrap gap-1.5">
                          {["Financiamento Bancário", "Dação de Imóvel", "Dação de Automóvel", "Permuta", "Plano Safra", "À Vista", "FGTS"].map((cond) => {
                            const isActive = property.paymentConditions?.includes(cond);
                            return (
                              <button key={cond} onClick={() => { if (!onUpdateProperty) return; const current = property.paymentConditions || []; const updated = isActive ? current.filter(c => c !== cond) : [...current, cond]; updateProperty({ ...property, paymentConditions: updated }); toast.success(isActive ? `"${cond}" removido` : `"${cond}" adicionado`); }}
                                className={cn("px-3 py-1.5 rounded-lg text-xs font-bold border transition-all", isActive ? "bg-blue-50 text-blue-700 border-blue-300" : "bg-background text-muted-foreground border-border hover:bg-muted")}>{cond}</button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-4">
                        <div className="flex items-center gap-3">
                          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Aceita Permuta</label>
                          <button onClick={() => { if (onUpdateProperty) { updateProperty({ ...property, acceptsExchange: !property.acceptsExchange }); toast.success(property.acceptsExchange ? "Permuta desativada" : "Permuta ativada"); } }}
                            className={cn("w-10 h-6 rounded-full transition-colors relative", property.acceptsExchange ? "bg-emerald-500" : "bg-gray-300")}>
                            <span className={cn("absolute w-4 h-4 rounded-full bg-card top-1 transition-all shadow-sm", property.acceptsExchange ? "left-5" : "left-1")} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-border">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block flex items-center gap-1">
                          <Flame className="w-3 h-3 text-orange-500" /> Classificação de Negócio
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {(["Oferta", "Bom Negócio", "Normal", "Acima da Média"] as const).map((lbl) => {
                            const isSelected = property.dealLabel === lbl;
                            const styles: Record<string, string> = { "Oferta": "text-emerald-700 bg-emerald-50 border-emerald-300 ring-emerald-400", "Bom Negócio": "text-emerald-600 bg-emerald-50 border-emerald-200 ring-emerald-300", "Normal": "text-primary bg-primary/10 border-amber-300 ring-amber-400", "Acima da Média": "text-red-600 bg-red-50 border-red-300 ring-red-400" };
                            return (
                              <button key={lbl} onClick={() => { const newLabel = isSelected ? null : lbl; if (onUpdateProperty) { updateProperty({ ...property, dealLabel: newLabel }); } toast.success(newLabel ? `Classificado como "${newLabel}"` : "Classificação removida"); }}
                                className={cn("px-4 py-2 rounded-lg text-sm font-bold border-2 transition-all", isSelected ? styles[lbl] + " ring-2 ring-offset-1 shadow-sm" : "text-muted-foreground bg-background border-border hover:bg-muted")}>
                                {lbl === "Oferta" && "🏷️ "}{lbl === "Bom Negócio" && "🏷️ "}{lbl}
                              </button>
                            );
                          })}
                        </div>
                        {property.dealLabel && (
                          <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> Classificação: <span className="font-bold text-foreground">{property.dealLabel}</span>
                          </p>
                        )}
                      </div>
                    </>
                  )}
                  {!isEditingValor && (
                    <div className="space-y-2 mt-3">
                      {property.paymentConditions && property.paymentConditions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {property.paymentConditions.map((c) => (
                            <span key={c} className="px-2 py-1 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">{c}</span>
                          ))}
                        </div>
                      )}
                      {property.dealLabel && (
                        <p className="text-[11px] text-muted-foreground">Classificação: <span className="font-bold">{property.dealLabel}</span></p>
                      )}
                      {property.acceptsExchange && <span className="text-[11px] font-bold text-orange-600">✓ Aceita Permuta</span>}
                    </div>
                  )}
                </div>
              );
            }

            if (blockId === "proprietario") {
              const propFields: FieldConfig[] = [
                { id: "owner", label: "Proprietário", render: () => editingBlock === "proprietario" ? (
                  <div className="w-full space-y-1.5">
                    <select value={property.owner || ""} onChange={(e) => { if (!onUpdateProperty) return; const selectedOwner = e.target.value; if (!selectedOwner) { updateProperty({ ...property, owner: undefined, ownerPhone: undefined, ownerType: undefined }); return; } const ref = allProperties.find(p => p.owner === selectedOwner && p.id !== property.id); if (ref) { updateProperty({ ...property, owner: selectedOwner, ownerPhone: ref.ownerPhone || property.ownerPhone, ownerType: ref.ownerType || property.ownerType }); toast.success(`Dados do proprietário "${selectedOwner}" aplicados!`); } else { updateProperty({ ...property, owner: selectedOwner }); } }} className="w-full px-3 py-2 rounded-lg border border-input text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="">Selecione</option>
                      {[...new Set(allProperties.map(p => p.owner).filter(Boolean))].sort().map(owner => (<option key={owner} value={owner}>{owner}</option>))}
                    </select>
                    <input type="text" placeholder="Ou digite um novo..." className="w-full px-3 py-1.5 rounded-lg border border-input text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" onKeyDown={(e) => { if (e.key === "Enter" && onUpdateProperty) { const val = (e.target as HTMLInputElement).value.trim(); if (val) { updateProperty({ ...property, owner: val }); toast.success(`Proprietário "${val}" definido!`); (e.target as HTMLInputElement).value = ""; } } }} />
                  </div>
                ) : <span className="text-sm font-medium text-foreground">{property.owner || "—"}</span> },
                { id: "ownerPhone", label: "Telefone", render: () => editingBlock === "proprietario" ? <EditableField field="ownerPhone" value={property.ownerPhone || ""} label="telefone" /> : <span className="text-sm font-medium text-foreground">{property.ownerPhone || "—"}</span> },
                { id: "ownerType", label: "Tipo Proprietário", render: () => editingBlock === "proprietario" ? (
                  <select value={property.ownerType || ""} onChange={(e) => { if (onUpdateProperty) { updateProperty({ ...property, ownerType: (e.target.value || undefined) as Property["ownerType"] }); toast.success("Tipo atualizado!"); } }} className="w-full px-3 py-2 rounded-lg border border-input text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Selecione</option>
                    <option value="Particular">Particular</option>
                    <option value="Construtora">Construtora</option>
                    <option value="Investidor">Investidor</option>
                    <option value="Adm Comercial">Adm Comercial</option>
                    <option value="Exclusividade">Exclusividade</option>
                  </select>
                ) : <span className="text-sm font-medium text-foreground">{property.ownerType || "—"}</span> },
                { id: "keysLocation", label: "Chaves do Imóvel", render: () => editingBlock === "proprietario" ? <EditableField field="keysLocation" value={property.keysLocation || ""} label="chaves" /> : <span className="text-sm font-medium text-foreground">{property.keysLocation || "—"}</span> },
                { id: "exclusivity", label: "Exclusividade", render: () => editingBlock === "proprietario" ? <EditableField field="exclusivityTerm" value={property.exclusivityTerm || ""} label="exclusividade" /> : <span className="text-sm font-medium text-foreground">{property.exclusivityTerm || "—"}</span> },
                { id: "broker", label: "Corretor", render: () => editingBlock === "proprietario" ? <EditableField field="broker" value={property.broker} label="corretor" /> : <span className="text-sm font-medium text-foreground">{property.broker}</span> },
              ];

              return blockWrapper("proprietario",
                <div className="bg-card rounded-2xl p-5 border border-border/60 shadow-[0_2px_8px_-2px_hsl(var(--foreground)/0.06)] hover:shadow-[0_8px_24px_-8px_hsl(var(--foreground)/0.12)] transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <span className="cursor-grab active:cursor-grabbing mr-1 text-muted-foreground/50 hover:text-muted-foreground">⠿</span>
                      <span className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center"><User className="w-3.5 h-3.5 text-blue-600" /></span> <span className="text-foreground">Proprietário</span>
                    </p>
                    <div className="flex items-center gap-2">
                      {property.exclusivityTermUrl && (
                        <button
                          onClick={() => setViewingTerm(true)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition-colors text-[11px] font-bold uppercase tracking-wide"
                          title="Ver termo de exclusividade"
                        >
                          <FileText className="w-3.5 h-3.5" /> Exclusividade
                        </button>
                      )}
                      <button onClick={() => setEditingBlock(editingBlock === "proprietario" ? null : "proprietario")} className={cn("p-1.5 rounded-lg transition-colors", editingBlock === "proprietario" ? "bg-primary/20 text-primary" : "hover:bg-muted text-muted-foreground")}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <DraggableFieldGrid storageKey="fields-proprietario" fields={propFields} editing={editingBlock === "proprietario"} />
                </div>
              );
            }

            if (blockId === "caracteristicas") {
              const isEditingCaract = editingBlock === "caracteristicas";
              const allCaracteristicas = [
                { group: "Terreno / Lote", items: ["Beira Lago", "Beira Rio", "Beira Mar", "Terreno Seco", "Terreno Alagadiço", "Murado", "Cercado", "Esquina", "Frente p/ Rua", "Plano", "Aclive", "Declive", "Aterrado"] },
                { group: "Documentação", items: ["Escriturado", "Financiável", "Registro de Imóveis", "IPTU em Dia", "Matrícula Atualizada"] },
                { group: "Estrutura", items: ["Laje", "Pé-Direito Duplo", "Cobertura", "Mezanino", "Varanda", "Sacada", "Lavabo", "Closet", "Suíte Master", "Dependência de Empregada"] },
              ];

              const selectClass = "w-full px-3 py-2 rounded-lg border border-input text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

              const caractFields: FieldConfig[] = [
                { id: "condicao", label: "Condição / Mobília", render: () => isEditingCaract ? (
                  <select value={property.condicao || ""} onChange={(e) => { if (onUpdateProperty) { const val = (e.target.value || undefined) as Property["condicao"]; updateProperty({ ...property, condicao: val, decorated: val === "Decorado" || val === "Mobiliado" }); toast.success("Condição atualizada!"); } }} className={selectClass}>
                    <option value="">Selecione</option>
                    <option value="Mobiliado">🛋️ Mobiliado</option>
                    <option value="Semi-mobiliado">🪑 Semi-mobiliado</option>
                    <option value="Vazio">📦 Vazio</option>
                    <option value="Decorado">🎨 Decorado</option>
                  </select>
                ) : <span className="text-sm font-medium text-foreground">{property.condicao || "—"}</span> },
                { id: "vista", label: "Vista", render: () => isEditingCaract ? (
                  <select value={property.vista || ""} onChange={(e) => { if (onUpdateProperty) { const val = e.target.value || undefined; updateProperty({ ...property, vista: val, seaView: val === "Mar" || val === "Mar / Lago" }); toast.success("Vista atualizada!"); } }} className={selectClass}>
                    <option value="">Selecione</option>
                    <option value="Mar">🌊 Mar</option>
                    <option value="Lago">💧 Lago</option>
                    <option value="Mar / Lago">🌊💧 Mar / Lago</option>
                    <option value="Cidade">🏙️ Cidade</option>
                    <option value="Parque">🌳 Parque</option>
                    <option value="Piscina">🏊 Piscina</option>
                    <option value="Rua">🛣️ Rua</option>
                    <option value="Interna">🏠 Interna</option>
                  </select>
                ) : <span className="text-sm font-medium text-foreground">{property.vista || "—"}</span> },
                { id: "padrao", label: "Padrão", render: () => isEditingCaract ? (
                  <select value={property.padrao || ""} onChange={(e) => { if (onUpdateProperty) { updateProperty({ ...property, padrao: (e.target.value || undefined) as Property["padrao"] }); toast.success("Padrão atualizado!"); } }} className={selectClass}>
                    <option value="">Selecione</option>
                    <option value="Econômico">Econômico</option>
                    <option value="Médio Padrão">Médio Padrão</option>
                    <option value="Alto Padrão">Alto Padrão</option>
                    <option value="Luxo">Luxo</option>
                  </select>
                ) : <span className="text-sm font-medium text-foreground">{property.padrao || "—"}</span> },
                { id: "posicaoPredio", label: "Posição no Prédio", render: () => isEditingCaract ? (
                  <select value={property.posicaoPredio || ""} onChange={(e) => { if (onUpdateProperty) { updateProperty({ ...property, posicaoPredio: e.target.value || undefined }); toast.success("Posição atualizada!"); } }} className={selectClass}>
                    <option value="">Selecione</option>
                    <option value="Frente">Frente</option>
                    <option value="Fundos">Fundos</option>
                    <option value="Lateral Esquerda">Lateral Esquerda</option>
                    <option value="Lateral Direita">Lateral Direita</option>
                    <option value="Frente/Lateral">Frente/Lateral</option>
                    <option value="Fundos/Lateral">Fundos/Lateral</option>
                  </select>
                ) : <span className="text-sm font-medium text-foreground">{property.posicaoPredio || "—"}</span> },
                { id: "posicaoSolar", label: "Posição Solar", render: () => isEditingCaract ? (
                  <select value={property.posicaoSolar || ""} onChange={(e) => { if (onUpdateProperty) { updateProperty({ ...property, posicaoSolar: e.target.value || undefined }); toast.success("Posição solar atualizada!"); } }} className={selectClass}>
                    <option value="">Selecione</option>
                    <option value="Nascente">Nascente (Sol da manhã)</option>
                    <option value="Poente">Poente (Sol da tarde)</option>
                    <option value="Norte">Norte</option>
                    <option value="Sul">Sul</option>
                    <option value="Nascente/Norte">Nascente/Norte</option>
                    <option value="Poente/Sul">Poente/Sul</option>
                  </select>
                ) : <span className="text-sm font-medium text-foreground">{property.posicaoSolar || "—"}</span> },
              ];

              return blockWrapper("caracteristicas",
                <div className="bg-card rounded-2xl p-5 border border-border/60 shadow-[0_2px_8px_-2px_hsl(var(--foreground)/0.06)] hover:shadow-[0_8px_24px_-8px_hsl(var(--foreground)/0.12)] transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <span className="cursor-grab active:cursor-grabbing mr-1 text-muted-foreground/50 hover:text-muted-foreground">⠿</span>
                      <span className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center"><Building2 className="w-3.5 h-3.5 text-purple-600" /></span> <span className="text-foreground">Características do Imóvel</span>
                    </p>
                    <button onClick={() => setEditingBlock(isEditingCaract ? null : "caracteristicas")} className={cn("p-1.5 rounded-lg transition-colors", isEditingCaract ? "bg-primary/20 text-primary" : "hover:bg-muted text-muted-foreground")}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <DraggableFieldGrid storageKey="fields-caracteristicas" fields={caractFields} columns={4} editing={isEditingCaract} />

                  {isEditingCaract && (
                    <>
                      <div className="mt-4 pt-4 border-t border-border">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Infraestrutura</label>
                        <div className="flex flex-wrap gap-1.5">
                          {["Piscina", "Churrasqueira", "Salão de Festas", "Academia", "Sauna", "Espaço Gourmet", "Brinquedoteca", "Playground", "Quadra", "Portaria 24h", "Elevador", "Jardim"].map((item) => {
                            const isActive = property.infraestrutura?.includes(item);
                            return (
                              <button key={item} onClick={() => { if (!onUpdateProperty) return; const current = property.infraestrutura || []; const updated = isActive ? current.filter(i => i !== item) : [...current, item]; updateProperty({ ...property, infraestrutura: updated }); toast.success(isActive ? `"${item}" removido` : `"${item}" adicionado`); }}
                                className={cn("px-3 py-1.5 rounded-lg text-xs font-bold border transition-all", isActive ? "bg-primary/10 text-primary border-amber-300" : "bg-background text-muted-foreground border-border hover:bg-muted")}>{item}</button>
                            );
                          })}
                        </div>
                        {property.infraestrutura?.includes("Elevador") && (
                          <div className="flex items-center gap-2 mt-2">
                            <label className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">Qtd. Elevadores:</label>
                            <input type="number" min={1} max={20} value={property.elevadores || 1} onChange={(e) => { if (!onUpdateProperty) return; updateProperty({ ...property, elevadores: parseInt(e.target.value) || 1 }); }} className="w-16 px-2 py-1 rounded border border-input text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                          </div>
                        )}
                      </div>
                      {allCaracteristicas.map(({ group, items }) => (
                        <div key={group} className="mt-4">
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">{group}</label>
                          <div className="flex flex-wrap gap-1.5">
                            {items.map((item) => {
                              const isActive = property.outrasCaracteristicas?.includes(item);
                              return (
                                <button key={item} onClick={() => { if (!onUpdateProperty) return; const current = property.outrasCaracteristicas || []; const updated = isActive ? current.filter(i => i !== item) : [...current, item]; updateProperty({ ...property, outrasCaracteristicas: updated }); toast.success(isActive ? `"${item}" removido` : `"${item}" adicionado`); }}
                                  className={cn("px-3 py-1.5 rounded-lg text-xs font-bold border transition-all", isActive ? "bg-blue-50 text-blue-700 border-blue-300" : "bg-background text-muted-foreground border-border hover:bg-muted")}>{item}</button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  {!isEditingCaract && (
                    <div className="space-y-2 mt-3">
                      {property.infraestrutura && property.infraestrutura.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {property.infraestrutura.map((i) => (
                            <span key={i} className="px-2 py-1 rounded text-[11px] font-bold bg-primary/10 text-primary border border-primary/30">{i}</span>
                          ))}
                        </div>
                      )}
                      {property.outrasCaracteristicas && property.outrasCaracteristicas.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {property.outrasCaracteristicas.map((i) => (
                            <span key={i} className="px-2 py-1 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">{i}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            return null;
          })}

          {/* Descrição do imóvel */}
          {property.description && (
            <div className="bg-card rounded-2xl p-5 border border-border/60 shadow-[0_2px_8px_-2px_hsl(var(--foreground)/0.06)] hover:shadow-[0_8px_24px_-8px_hsl(var(--foreground)/0.12)] transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center"><FileText className="w-3.5 h-3.5 text-amber-600" /></span> <span className="text-foreground">Descrição</span>
                </p>
                <button
                  onClick={() => setEditingField(editingField === "description" ? null : "description")}
                  className={cn("p-1.5 rounded-lg transition-colors", editingField === "description" ? "bg-primary/20 text-primary" : "hover:bg-muted text-muted-foreground")}
                  title="Editar descrição"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
              {editingField === "description" ? (
                <div className="space-y-2">
                  <textarea
                    value={editValues.description ?? property.description}
                    onChange={(e) => setEditValues((prev) => ({ ...prev, description: e.target.value }))}
                    rows={10}
                    className="w-full px-3 py-2 rounded-lg border border-input text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { saveEdit("description"); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90"
                    >
                      <Check className="w-3.5 h-3.5" /> Salvar
                    </button>
                    <button
                      onClick={() => { setEditingField(null); setEditValues((prev) => { const n = { ...prev }; delete n.description; return n; }); }}
                      className="px-3 py-1.5 rounded-lg bg-muted text-foreground text-xs font-bold hover:bg-muted/70"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                  {property.description}
                </p>
              )}
            </div>
          )}

          {/* Broker + WhatsApp */}
          <div className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border">
            {broker ? (
              <Link
                to={`/corretor/${toSlug(property.broker)}`}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                onClick={onClose}
              >
                <img src={broker.photo} alt={property.broker} className="w-12 h-12 rounded-full object-cover border-2 border-primary" />
                <div>
                  <p className="text-sm font-bold text-primary hover:underline">{property.broker}</p>
                  <p className="text-[11px] text-muted-foreground/70">Corretor(a) responsável</p>
                </div>
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground font-medium">{property.broker}</p>
            )}
            <div className="flex items-center gap-2">
              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-600 transition-colors shadow-sm">
                <MapPin className="w-4 h-4" /> Mapa
              </a>
              <a href={`https://wa.me/${broker?.whatsapp || "5511999999999"}?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors shadow-sm">
                <Phone className="w-4 h-4" /> WhatsApp
              </a>
            </div>
          </div>
        </div>

        {/* Outros imóveis do proprietário */}
        {ownerProperties.length > 0 && (
          <div className="border-t border-border p-5 sm:p-6">
            <h3 className="text-base font-bold text-foreground mb-4">Outros imóveis de {property.owner}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ownerProperties.map((sp) => (
                <SimilarCard key={sp.id} property={sp} onSelect={() => { setCurrentImageIndex(0); setShowVideo(false); onSelectSimilar?.(sp); }} />
              ))}
            </div>
          </div>
        )}
      </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 pt-6 pb-4">
          {hasChanges && (
            <button
              onClick={handleConfirmUpdate}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 text-white text-sm font-bold shadow-lg hover:bg-emerald-600 transition-all"
            >
              <Check className="w-4 h-4" /> Atualizar Imóvel
            </button>
          )}
        </div>

        {/* Termo de Exclusividade Modal */}
        {viewingTerm && property.exclusivityTermUrl && (
          <div
            className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setViewingTerm(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-500" /> Termo de Exclusividade
                </h3>
                <div className="flex items-center gap-2">
                  <a
                    href={property.exclusivityTermUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity"
                  >
                    <Download className="w-3.5 h-3.5" /> Baixar
                  </a>
                  <button
                    onClick={() => setViewingTerm(false)}
                    className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
                    aria-label="Fechar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-muted/30">
                {/\.pdf(\?|$)/i.test(property.exclusivityTermUrl) ? (
                  <iframe src={property.exclusivityTermUrl} className="w-full h-[75vh] rounded-lg border border-border bg-card" title="Termo de Exclusividade" />
                ) : (
                  <img src={property.exclusivityTermUrl} alt="Termo de Exclusividade" className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-md" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Lightbox / Zoom */}
        {lightboxIndex !== null && images[lightboxIndex] && (
          <div
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setLightboxIndex(null)}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
              className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              aria-label="Fechar"
            >
              <X className="w-6 h-6" />
            </button>
            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i === null ? 0 : (i - 1 + images.length) % images.length)); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  aria-label="Anterior"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i === null ? 0 : (i + 1) % images.length)); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  aria-label="Próxima"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
            <img
              src={images[lightboxIndex]}
              alt={property.title}
              onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white/10 text-white text-sm font-medium backdrop-blur-sm">
              {lightboxIndex + 1} / {images.length}
            </div>
          </div>
        )}
    </div>
  );
}

function SimilarCard({ property, onSelect }: { property: Property; onSelect: () => void }) {
  const [imgIndex, setImgIndex] = useState(0);
  const imgs = property.images && property.images.length > 0 ? property.images : [property.image];

  return (
    <button onClick={onSelect} className="rounded-xl overflow-hidden bg-muted/40 hover:bg-muted transition-colors text-left border border-border group">
      <div className="relative h-28 overflow-hidden">
        <img src={imgs[imgIndex]} alt={property.title} className="w-full h-full object-cover" />
        {imgs.length > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); setImgIndex((prev) => (prev > 0 ? prev - 1 : imgs.length - 1)); }}
              className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-card/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setImgIndex((prev) => (prev < imgs.length - 1 ? prev + 1 : 0)); }}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-card/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight className="w-3 h-3" />
            </button>
          </>
        )}
        <div className="absolute bottom-1.5 left-1.5">
          <p className="text-sm font-bold text-white drop-shadow-lg">{formatCurrency(property.price)}</p>
        </div>
      </div>
      <div className="p-2.5">
        <p className="text-xs font-semibold text-foreground line-clamp-1">{property.title}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{property.city} · {property.area}m²</p>
      </div>
    </button>
  );
}
