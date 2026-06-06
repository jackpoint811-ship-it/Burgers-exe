import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import type { CreateRaffleCampaignPayload, RaffleCampaignV2, RaffleParticipantSummary, RaffleReferralCodeV2, RaffleReferralStatus, RaffleReferralV2, RaffleSummaryResponse } from "@config/index";
import { Button, Card, StatusPill } from "@ui/index";
import { createRaffleCampaignV2, createRaffleReferralCodeV2, deleteRaffleCampaignV2, fetchRaffleCampaignsV2, fetchRaffleReferralCodesV2, fetchRaffleReferralsV2, fetchRaffleSummaryV2, deleteRaffleCampaignImageV2, updateRaffleCampaignV2, updateRaffleReferralCodeV2, updateRaffleReferralV2, uploadRaffleCampaignImageV2, type RaffleImageKind } from "../lib/raffles-v2-admin";
import { RAFFLE_SHARE_FALLBACK_CODE, buildRaffleShareText, buildWhatsAppUrl, downloadBlob, generateRaffleTicketImage, shareBlobIfSupported, type RaffleShareImageData } from "../lib/raffle-share-image";

type RaffleSummary = NonNullable<RaffleSummaryResponse["data"]>;
type RaffleForm = {
  id?: string;
  title: string;
  description: string;
  rulesText: string;
  bannerImageUrl: string;
  bannerImageKey: string;
  detailImageUrl: string;
  detailImageKey: string;
  startsAt: string;
  endsAt: string;
  ticketPerBurger: string;
  ticketPerReferral: string;
  isActive: boolean;
};

const BURGER_WORDS = ["BURGER", "SMASH", "BACON", "PICKLES", "PICKLE", "CHEESE", "FRIES", "PAPAS", "TOCINO", "QUESO", "CRUNCH", "BBQ", "COMBO", "OG", "CHEDDAR", "KETCHUP", "MOSTAZA"] as const;
const MAX_RAFFLE_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_RAFFLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const SAFE_IMAGE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

type ReferralCodeForm = { ownerName: string; ownerPhone: string; burgerWord: typeof BURGER_WORDS[number]; number: string };
const emptyReferralCodeForm = (): ReferralCodeForm => ({ ownerName: "", ownerPhone: "", burgerWord: "BURGER", number: "27" });

const emptyForm = (): RaffleForm => ({
  title: "",
  description: "",
  rulesText: "",
  bannerImageUrl: "",
  bannerImageKey: "",
  detailImageUrl: "",
  detailImageKey: "",
  startsAt: "",
  endsAt: "",
  ticketPerBurger: "1",
  ticketPerReferral: "2",
  isActive: false,
});

const toForm = (campaign: RaffleCampaignV2): RaffleForm => ({
  id: campaign.id,
  title: campaign.title,
  description: campaign.description ?? "",
  rulesText: campaign.rulesText ?? "",
  bannerImageUrl: campaign.bannerImageUrl ?? "",
  bannerImageKey: campaign.bannerImageKey ?? "",
  detailImageUrl: campaign.detailImageUrl ?? "",
  detailImageKey: campaign.detailImageKey ?? "",
  startsAt: campaign.startsAt ?? "",
  endsAt: campaign.endsAt ?? "",
  ticketPerBurger: String(campaign.ticketPerBurger ?? 1),
  ticketPerReferral: String(campaign.ticketPerReferral ?? 2),
  isActive: campaign.isActive,
});

const formatDateTime = (value?: string) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
};

const participantKey = (participant: RaffleParticipantSummary) => `${participant.customerPhoneMasked}-${participant.lastOrderFolio}`;

const normalizeLookupName = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();

const resolveReferralCodeForParticipant = (participant: RaffleParticipantSummary, codes: RaffleReferralCodeV2[]) => {
  const normalizedName = normalizeLookupName(participant.customerName);
  const strongMatches = codes.filter((code) => (
    code.isActive
    && code.ownerPhoneMasked === participant.customerPhoneMasked
    && normalizeLookupName(code.ownerName) === normalizedName
  ));
  if (strongMatches.length === 1) return strongMatches[0]?.code ?? RAFFLE_SHARE_FALLBACK_CODE;
  return RAFFLE_SHARE_FALLBACK_CODE;
};


const isSafeSameOriginPath = (value: string) => value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && !value.includes("..");
const isSafeHttpsImageUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};
const isSafeAssetKey = (value: string) => {
  const key = value.trim().replace(/^\/+/, "");
  if (!key || !SAFE_IMAGE_KEY_PATTERN.test(key) || key.includes("..") || key.includes("\\") || key.includes("//")) return false;
  return key.split("/").every((segment) => segment && segment !== "." && segment !== "..");
};
const resolveAssetUrl = (imageUrl?: string, imageKey?: string): string | undefined => {
  const trimmedKey = imageKey?.trim().replace(/^\/+/, "");
  if (trimmedKey && isSafeAssetKey(trimmedKey)) return `/api/assets-v2/${trimmedKey.split("/").map((segment) => encodeURIComponent(segment)).join("/")}`;

  const trimmedUrl = imageUrl?.trim();
  if (trimmedUrl && (isSafeSameOriginPath(trimmedUrl) || isSafeHttpsImageUrl(trimmedUrl))) return trimmedUrl;
  return undefined;
};

type ImageUploadState = { file: File | null; uploading: boolean; error: string | null; message: string | null };
const emptyImageUploadState = (): ImageUploadState => ({ file: null, uploading: false, error: null, message: null });

const validateImageFile = (file: File): string | null => {
  if (!ALLOWED_RAFFLE_IMAGE_TYPES.has(file.type)) return "Usa JPG, PNG, WebP o AVIF.";
  if (file.size > MAX_RAFFLE_IMAGE_BYTES) return "La imagen debe pesar 5 MB o menos.";
  return null;
};

const makeShareFilename = (data: RaffleShareImageData) => {
  const safeName = data.customerName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "participante";
  return `burgers-exe-tickets-${safeName}.png`;
};

const RaffleShareImageModal = ({ data, onClose }: { data: RaffleShareImageData; onClose: () => void }) => {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const shareText = useMemo(() => buildRaffleShareText(data), [data]);
  const [canShareFiles, setCanShareFiles] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let nextUrl: string | null = null;
    setLoadingImage(true);
    setShareError(null);
    setActionMessage(null);
    setBlob(null);
    setPreviewUrl(null);
    generateRaffleTicketImage(data)
      .then((nextBlob) => {
        if (cancelled) return;
        nextUrl = URL.createObjectURL(nextBlob);
        setBlob(nextBlob);
        setPreviewUrl(nextUrl);
        const file = new File([nextBlob], "burgers-exe-tickets.png", { type: "image/png" });
        setCanShareFiles(Boolean("share" in navigator && navigator.canShare?.({ files: [file], text: shareText, title: "Burgers.exe tickets" })));
      })
      .catch((imageError) => {
        if (!cancelled) setShareError(imageError instanceof Error ? imageError.message : "No se pudo generar la imagen.");
      })
      .finally(() => { if (!cancelled) setLoadingImage(false); });
    return () => {
      cancelled = true;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [data, shareText]);

  const copyText = async () => {
    setShareError(null);
    try {
      await navigator.clipboard.writeText(shareText);
      setActionMessage("Texto copiado para WhatsApp.");
    } catch {
      setShareError("No se pudo copiar el texto. Selecciónalo manualmente desde la vista previa.");
    }
  };

  const downloadImage = () => {
    if (!blob) { setShareError("Espera a que termine de generarse la imagen."); return; }
    downloadBlob(blob, makeShareFilename(data));
    setActionMessage("Imagen descargada.");
  };

  const openWhatsApp = () => {
    window.open(buildWhatsAppUrl(shareText), "_blank", "noopener,noreferrer");
    setActionMessage("WhatsApp abierto con texto. Adjunta la imagen manualmente si ya la descargaste.");
  };

  const shareImage = async () => {
    if (!blob) { setShareError("Espera a que termine de generarse la imagen."); return; }
    setShareError(null);
    try {
      const shared = await shareBlobIfSupported(blob, shareText);
      if (shared) setActionMessage("Imagen enviada al selector de compartir.");
      else setShareError("Tu navegador no permite compartir archivos. Descarga la imagen y compártela manualmente.");
    } catch (shareImageError) {
      setShareError(shareImageError instanceof Error ? shareImageError.message : "No se pudo compartir la imagen.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="raffle-share-title">
      <div className="max-h-[96vh] w-full max-w-5xl overflow-y-auto rounded-t-3xl border border-emerald-400/30 bg-zinc-950 p-4 shadow-2xl shadow-emerald-950/40 sm:rounded-3xl sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-emerald-200">Imagen para compartir</p>
            <h3 id="raffle-share-title" className="text-xl font-black text-zinc-50">Imagen para WhatsApp</h3>
            <p className="mt-1 text-xs text-zinc-400">WhatsApp no permite adjuntar imagen automáticamente desde este botón. Descarga la imagen y adjúntala manualmente.</p>
          </div>
          <Button type="button" className="border border-zinc-700 px-3 py-2 text-sm" onClick={onClose}>Cerrar</Button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-zinc-800 bg-black p-3">
            {loadingImage ? <div className="grid min-h-[380px] place-items-center text-sm font-bold text-emerald-200">Generando imagen…</div> : null}
            {!loadingImage && previewUrl ? <img src={previewUrl} alt={`Imagen de tickets de ${data.customerName}`} className="mx-auto max-h-[72vh] w-full rounded-xl object-contain" /> : null}
            {!loadingImage && !previewUrl ? <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">No se pudo mostrar la imagen.</div> : null}
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Datos incluidos</p>
              <div className="mt-2 grid gap-2 text-sm text-zinc-200 sm:grid-cols-2">
                <span>Nombre: <strong>{data.customerName}</strong></span>
                <span>Teléfono: <strong>{data.customerPhoneMasked}</strong></span>
                <span>Total: <strong>{data.totalTickets}</strong></span>
                <span>Burger tickets: <strong>{data.burgerTickets}</strong></span>
                <span>Referidos: <strong>{data.referralTickets}</strong></span>
                <span>Código: <strong>{data.referralCodeText}</strong></span>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" className="bg-emerald-400 px-4 py-3 font-black text-emerald-950 disabled:opacity-50" disabled={!blob || loadingImage} onClick={downloadImage}>Descargar PNG</Button>
              <Button type="button" className="border border-cyan-400/40 bg-cyan-400/10 px-4 py-3 font-black text-cyan-100" onClick={() => void copyText()}>Copiar texto</Button>
              <Button type="button" className="border border-emerald-500/40 bg-zinc-900 px-4 py-3 font-black text-emerald-100" onClick={openWhatsApp}>Abrir WhatsApp</Button>
              {canShareFiles ? <Button type="button" className="border border-violet-400/40 bg-violet-400/10 px-4 py-3 font-black text-violet-100 disabled:opacity-50" disabled={!blob || loadingImage} onClick={() => void shareImage()}>Compartir imagen</Button> : null}
            </div>

            {!canShareFiles ? <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">Compartir imagen no está disponible en este navegador. Descarga la imagen y compártela manualmente.</p> : null}
            {actionMessage ? <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">{actionMessage}</p> : null}
            {shareError ? <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">{shareError}</p> : null}
            <textarea className="input min-h-44 text-sm" readOnly value={shareText} aria-label="Texto para WhatsApp" />
          </div>
        </div>
      </div>
    </div>
  );
};

const ParticipantList = ({ title, participants, empty, onImage }: { title: string; participants: RaffleParticipantSummary[]; empty: string; onImage: (participant: RaffleParticipantSummary) => void }) => (
  <Card className="p-3">
    <h3 className="text-sm font-black text-zinc-100">{title}</h3>
    <div className="mt-3 space-y-2">
      {participants.length ? participants.map((participant) => (
        <div key={participantKey(participant)} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-black text-zinc-50">{participant.customerName}</p>
              <p className="text-xs text-zinc-400">{participant.customerPhoneMasked} · Último folio {participant.lastOrderFolio || "—"}</p>
              <p className="text-xs text-zinc-500">Último pedido: {formatDateTime(participant.lastOrderAt)}</p>
            </div>
            <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
              <strong className="text-2xl font-black text-emerald-300">{participant.totalTickets}</strong>
              <Button type="button" className="border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-100" onClick={() => onImage(participant)}>Imagen</Button>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px] text-zinc-300">
            <span className="rounded-lg bg-zinc-900 px-2 py-1">Burger tickets: {participant.burgerTickets}</span>
            <span className="rounded-lg bg-zinc-900 px-2 py-1">Referral tickets: {participant.referralTickets}</span>
            <span className="rounded-lg bg-emerald-400/10 px-2 py-1 text-emerald-200">Total: {participant.totalTickets}</span>
          </div>
        </div>
      )) : <p className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-400">{empty}</p>}
    </div>
  </Card>
);

export const RafflesAdminPanel = () => {
  const [campaigns, setCampaigns] = useState<RaffleCampaignV2[]>([]);
  const [summary, setSummary] = useState<RaffleSummary | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [form, setForm] = useState<RaffleForm>(() => emptyForm());
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [referralCodes, setReferralCodes] = useState<RaffleReferralCodeV2[]>([]);
  const [referrals, setReferrals] = useState<RaffleReferralV2[]>([]);
  const [codeSearch, setCodeSearch] = useState("");
  const [referralSearch, setReferralSearch] = useState("");
  const [referralStatus, setReferralStatus] = useState<RaffleReferralStatus | "all">("all");
  const [referralCodeForm, setReferralCodeForm] = useState<ReferralCodeForm>(() => emptyReferralCodeForm());
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [invalidReasons, setInvalidReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shareParticipant, setShareParticipant] = useState<RaffleParticipantSummary | null>(null);
  const [bannerUpload, setBannerUpload] = useState<ImageUploadState>(() => emptyImageUploadState());
  const [detailUpload, setDetailUpload] = useState<ImageUploadState>(() => emptyImageUploadState());

  const activeCampaign = useMemo(() => campaigns.find((campaign) => campaign.isActive) ?? null, [campaigns]);
  const selectedCampaign = useMemo(() => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? activeCampaign, [activeCampaign, campaigns, selectedCampaignId]);
  const currentBannerPreview = resolveAssetUrl(form.bannerImageUrl, form.bannerImageKey);
  const currentDetailPreview = resolveAssetUrl(form.detailImageUrl, form.detailImageKey);

  const imageStateForKind = (kind: RaffleImageKind) => (kind === "banner" ? bannerUpload : detailUpload);
  const setImageStateForKind = (kind: RaffleImageKind, updater: (current: ImageUploadState) => ImageUploadState) => {
    if (kind === "banner") setBannerUpload(updater);
    else setDetailUpload(updater);
  };

  const applyUpdatedCampaign = async (campaign: RaffleCampaignV2) => {
    setForm(toForm(campaign));
    setSelectedCampaignId(campaign.id);
    setCampaigns(await fetchRaffleCampaignsV2());
    setSummary(await fetchRaffleSummaryV2({ campaignId: campaign.id, q: debouncedSearch }));
  };

  const handleImageFileChange = (kind: RaffleImageKind, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    const validationError = file ? validateImageFile(file) : null;
    setImageStateForKind(kind, () => ({ file: validationError ? null : file, uploading: false, error: validationError, message: null }));
  };

  const uploadImage = async (kind: RaffleImageKind) => {
    if (!form.id) {
      setImageStateForKind(kind, (current) => ({ ...current, error: "Guarda o selecciona un sorteo antes de subir imágenes.", message: null }));
      return;
    }
    const current = imageStateForKind(kind);
    if (!current.file) {
      setImageStateForKind(kind, (state) => ({ ...state, error: "Selecciona una imagen válida.", message: null }));
      return;
    }
    setImageStateForKind(kind, (state) => ({ ...state, uploading: true, error: null, message: null }));
    try {
      const result = await uploadRaffleCampaignImageV2(form.id, kind, current.file);
      await applyUpdatedCampaign(result.campaign);
      setImageStateForKind(kind, () => ({ file: null, uploading: false, error: null, message: result.warning || "Imagen subida y conectada al sorteo." }));
    } catch (uploadError) {
      setImageStateForKind(kind, (state) => ({ ...state, uploading: false, error: uploadError instanceof Error ? uploadError.message : "No se pudo subir la imagen.", message: null }));
    }
  };

  const removeImage = async (kind: RaffleImageKind) => {
    if (!form.id) return;
    setImageStateForKind(kind, (state) => ({ ...state, uploading: true, error: null, message: null }));
    try {
      const result = await deleteRaffleCampaignImageV2(form.id, kind);
      await applyUpdatedCampaign(result.campaign);
      setImageStateForKind(kind, () => ({ file: null, uploading: false, error: null, message: result.warning || "Imagen quitada del sorteo." }));
    } catch (removeError) {
      setImageStateForKind(kind, (state) => ({ ...state, uploading: false, error: removeError instanceof Error ? removeError.message : "No se pudo quitar la imagen.", message: null }));
    }
  };

  const shareImageData = useMemo<RaffleShareImageData | null>(() => {
    if (!shareParticipant) return null;
    const campaign = summary?.campaign ?? selectedCampaign ?? activeCampaign;
    return {
      customerName: shareParticipant.customerName,
      customerPhoneMasked: shareParticipant.customerPhoneMasked,
      campaignTitle: campaign?.title ?? "Sorteo mensual",
      burgerTickets: shareParticipant.burgerTickets,
      referralTickets: shareParticipant.referralTickets,
      totalTickets: shareParticipant.totalTickets,
      lastOrderFolio: shareParticipant.lastOrderFolio,
      lastOrderAt: shareParticipant.lastOrderAt,
      referralCodeText: resolveReferralCodeForParticipant(shareParticipant, referralCodes),
      generatedAt: new Date(),
      rulesText: campaign?.rulesText ?? undefined,
    };
  }, [activeCampaign, referralCodes, selectedCampaign, shareParticipant, summary?.campaign]);

  const reload = async () => {
    setError(null);
    setLoading(true);
    try {
      const nextCampaigns = await fetchRaffleCampaignsV2();
      setCampaigns(nextCampaigns);
      const nextSelected = selectedCampaignId || nextCampaigns.find((campaign) => campaign.isActive)?.id || nextCampaigns[0]?.id || "";
      if (nextSelected) setSelectedCampaignId(nextSelected);
      const nextSummary = await fetchRaffleSummaryV2({ campaignId: nextSelected || undefined, q: debouncedSearch });
      setSummary(nextSummary);
      if (nextSelected) {
        setReferralCodes(await fetchRaffleReferralCodesV2({ campaignId: nextSelected, q: codeSearch }));
        setReferrals(await fetchRaffleReferralsV2({ campaignId: nextSelected, q: referralSearch, status: referralStatus }));
      }
      if (!form.id && nextCampaigns.length) setForm(toForm(nextCampaigns.find((campaign) => campaign.id === nextSelected) ?? nextCampaigns[0]));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar sorteos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 320);
    return () => window.clearTimeout(timeout);
  }, [search]);
  useEffect(() => {
    if (!selectedCampaignId && !activeCampaign) return;
    fetchRaffleSummaryV2({ campaignId: selectedCampaignId || undefined, q: debouncedSearch })
      .then(setSummary)
      .catch((summaryError) => setError(summaryError instanceof Error ? summaryError.message : "No se pudo cargar el resumen."));
  }, [selectedCampaignId, debouncedSearch, activeCampaign]);

  useEffect(() => {
    if (!selectedCampaignId) return;
    const timeout = window.setTimeout(() => {
      fetchRaffleReferralCodesV2({ campaignId: selectedCampaignId, q: codeSearch }).then(setReferralCodes).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar códigos."));
    }, 320);
    return () => window.clearTimeout(timeout);
  }, [selectedCampaignId, codeSearch]);

  useEffect(() => {
    if (!selectedCampaignId) return;
    const timeout = window.setTimeout(() => {
      fetchRaffleReferralsV2({ campaignId: selectedCampaignId, q: referralSearch, status: referralStatus }).then(setReferrals).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar referidos."));
    }, 320);
    return () => window.clearTimeout(timeout);
  }, [selectedCampaignId, referralSearch, referralStatus]);

  const payloadFromForm = (): CreateRaffleCampaignPayload | null => {
    const title = form.title.trim();
    if (title.length < 3 || title.length > 80) {
      setError("El título debe tener entre 3 y 80 caracteres.");
      return null;
    }
    const ticketPerBurger = Number(form.ticketPerBurger || 1);
    const ticketPerReferral = Number(form.ticketPerReferral || 2);
    if (!Number.isInteger(ticketPerBurger) || ticketPerBurger < 0 || !Number.isInteger(ticketPerReferral) || ticketPerReferral < 0) {
      setError("Los tickets deben ser enteros no negativos.");
      return null;
    }
    const optionalValue = (value: string) => {
      const trimmed = value.trim();
      return form.id ? trimmed : trimmed || undefined;
    };

    return {
      title,
      description: optionalValue(form.description),
      rulesText: optionalValue(form.rulesText),
      bannerImageUrl: optionalValue(form.bannerImageUrl),
      bannerImageKey: optionalValue(form.bannerImageKey),
      detailImageUrl: optionalValue(form.detailImageUrl),
      detailImageKey: optionalValue(form.detailImageKey),
      startsAt: optionalValue(form.startsAt),
      endsAt: optionalValue(form.endsAt),
      ticketPerBurger,
      ticketPerReferral,
      isActive: form.isActive,
    };
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = payloadFromForm();
    if (!payload) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const campaign = form.id ? await updateRaffleCampaignV2(form.id, payload) : await createRaffleCampaignV2(payload);
      setNotice(form.id ? "Sorteo actualizado." : "Sorteo creado.");
      setForm(toForm(campaign));
      setSelectedCampaignId(campaign.id);
      const nextCampaigns = await fetchRaffleCampaignsV2();
      setCampaigns(nextCampaigns);
      setSummary(await fetchRaffleSummaryV2({ campaignId: campaign.id, q: debouncedSearch }));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el sorteo.");
    } finally {
      setSaving(false);
    }
  };

  const activate = async (campaign: RaffleCampaignV2, isActive: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateRaffleCampaignV2(campaign.id, { isActive });
      setNotice(updated.isActive ? "Sorteo activado. Las demás campañas quedaron desactivadas." : "Sorteo desactivado.");
      setCampaigns(await fetchRaffleCampaignsV2());
      setSummary(await fetchRaffleSummaryV2({ campaignId: updated.id, q: debouncedSearch }));
      setForm(toForm(updated));
      setSelectedCampaignId(updated.id);
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : "No se pudo cambiar el estado del sorteo.");
    } finally {
      setSaving(false);
    }
  };

  const deleteCampaign = async (campaign: RaffleCampaignV2) => {
    const confirmed = window.confirm(
      "Este sorteo dejará de mostrarse y no afectará tickets históricos.",
    );
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await deleteRaffleCampaignV2(campaign.id);
      const nextCampaigns = await fetchRaffleCampaignsV2();
      setCampaigns(nextCampaigns);
      const nextSelected = nextCampaigns.find((item) => item.isActive)?.id || nextCampaigns[0]?.id || "";
      setSelectedCampaignId(nextSelected);
      setForm(nextSelected ? toForm(nextCampaigns.find((item) => item.id === nextSelected) ?? nextCampaigns[0]) : emptyForm());
      setSummary(await fetchRaffleSummaryV2({ campaignId: nextSelected || undefined, q: debouncedSearch }));
      if (nextSelected) {
        setReferralCodes(await fetchRaffleReferralCodesV2({ campaignId: nextSelected, q: codeSearch }));
        setReferrals(await fetchRaffleReferralsV2({ campaignId: nextSelected, q: referralSearch, status: referralStatus }));
      } else {
        setReferralCodes([]);
        setReferrals([]);
      }
      setNotice("Sorteo ocultado. Los tickets históricos siguen disponibles en registros internos.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo ocultar el sorteo.");
    } finally {
      setSaving(false);
    }
  };

  const createReferralCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCampaign) { setError("Selecciona un sorteo."); return; }
    const number = Number(referralCodeForm.number);
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const code = await createRaffleReferralCodeV2({ campaignId: selectedCampaign.id, ownerName: referralCodeForm.ownerName.trim(), ownerPhone: referralCodeForm.ownerPhone.trim(), burgerWord: referralCodeForm.burgerWord, number });
      setGeneratedCode(code.code);
      setNotice("Código de invitado listo para copiar.");
      setReferralCodeForm(emptyReferralCodeForm());
      setReferralCodes(await fetchRaffleReferralCodesV2({ campaignId: selectedCampaign.id, q: codeSearch }));
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "No se pudo crear el código.");
    } finally {
      setSaving(false);
    }
  };

  const toggleReferralCode = async (code: RaffleReferralCodeV2) => {
    setSaving(true);
    try {
      await updateRaffleReferralCodeV2(code.id, { isActive: !code.isActive });
      if (selectedCampaign) setReferralCodes(await fetchRaffleReferralCodesV2({ campaignId: selectedCampaign.id, q: codeSearch }));
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "No se pudo actualizar el código.");
    } finally {
      setSaving(false);
    }
  };

  const setReferralState = async (referral: RaffleReferralV2, status: RaffleReferralStatus) => {
    const invalidReason = invalidReasons[referral.id]?.trim();
    setSaving(true);
    try {
      await updateRaffleReferralV2(referral.id, { status, ...(status === "invalid" ? { invalidReason } : {}) });
      if (selectedCampaign) {
        setReferrals(await fetchRaffleReferralsV2({ campaignId: selectedCampaign.id, q: referralSearch, status: referralStatus }));
        setSummary(await fetchRaffleSummaryV2({ campaignId: selectedCampaign.id, q: debouncedSearch }));
      }
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "No se pudo actualizar el referido.");
    } finally {
      setSaving(false);
    }
  };

  const renderImageBlock = (options: { kind: RaffleImageKind; title: string; recommendation: string; preview?: string; currentKey: string; state: ImageUploadState }) => (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="font-black text-zinc-100">{options.title}</h4>
          <p className="text-xs text-zinc-500">Recomendado: {options.recommendation}. JPG, PNG, WebP o AVIF hasta 5 MB.</p>
        </div>
        {options.currentKey ? <span className="break-all rounded-lg bg-zinc-900 px-2 py-1 text-[10px] text-zinc-400">{options.currentKey}</span> : null}
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-zinc-800 bg-black/40">
        {options.preview ? (
          <img src={options.preview} alt={options.title} className={`w-full ${options.kind === "banner" ? "aspect-video object-cover" : "max-h-[420px] object-contain"}`} onError={(event) => { event.currentTarget.style.display = "none"; }} />
        ) : (
          <div className="grid min-h-32 place-items-center px-4 py-8 text-center text-sm text-zinc-500">Sin imagen cargada.</div>
        )}
      </div>
      <div className="mt-3 grid gap-2">
        <input className="input" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => handleImageFileChange(options.kind, event)} disabled={options.state.uploading || !form.id} />
        {options.state.file ? <p className="text-xs text-zinc-400">Listo para subir: {options.state.file.name}</p> : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" className="bg-emerald-400 px-4 py-3 font-black text-emerald-950 disabled:opacity-50" disabled={!form.id || !options.state.file || options.state.uploading} onClick={() => void uploadImage(options.kind)}>{options.state.uploading ? "Subiendo…" : "Subir"}</Button>
          <Button type="button" className="border border-rose-500/40 bg-rose-500/10 px-4 py-3 font-black text-rose-100 disabled:opacity-50" disabled={!form.id || !options.preview || options.state.uploading} onClick={() => void removeImage(options.kind)}>Quitar</Button>
        </div>
        {!form.id ? <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-100">Primero guarda o selecciona un sorteo para habilitar uploads.</p> : null}
        {options.state.error ? <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{options.state.error}</p> : null}
        {options.state.message ? <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">{options.state.message}</p> : null}
      </div>
    </div>
  );

  return (
    <section className="grid gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
      <div className="space-y-3">
        <Card className="p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-emerald-200">Sorteos</p>
              <h2 className="text-xl font-black text-zinc-50">Campañas mensuales</h2>
              <p className="mt-1 text-xs text-zinc-400">Tickets por burger y referidos.</p>
            </div>
            <Button className="border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs" onClick={() => void reload()} disabled={loading}>Recargar</Button>
          </div>
          {activeCampaign ? (
            <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3">
              <p className="text-xs font-bold text-emerald-100">Activa ahora</p>
              <p className="font-black text-zinc-50">{activeCampaign.title}</p>
              <p className="text-xs text-zinc-400">{activeCampaign.ticketPerBurger} ticket por burger · {activeCampaign.ticketPerReferral} por referido</p>
            </div>
          ) : <p className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-400">No hay sorteo activo; Public no mostrará banner.</p>}
        </Card>

        <Card className="p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-black text-zinc-100">Campañas</h3>
            <Button className="border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100" onClick={() => { setForm(emptyForm()); setNotice(null); setError(null); }}>Nueva</Button>
          </div>
          <div className="space-y-2">
            {campaigns.length ? campaigns.map((campaign) => (
              <button key={campaign.id} type="button" className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 text-left" onClick={() => { setForm(toForm(campaign)); setSelectedCampaignId(campaign.id); }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-zinc-100">{campaign.title}</p>
                  <StatusPill className={campaign.isActive ? "border-emerald-400/40 text-emerald-200" : "border-zinc-700 text-zinc-400"}>{campaign.isActive ? "Activa" : "Inactiva"}</StatusPill>
                </div>
                <p className="mt-1 text-xs text-zinc-500">Creada: {formatDateTime(campaign.createdAt)}</p>
              </button>
            )) : <p className="rounded-xl border border-zinc-800 p-3 text-sm text-zinc-400">Sin campañas creadas.</p>}
          </div>
        </Card>

        <Card className="p-3">
          <h3 className="font-black text-zinc-100">Crear / editar</h3>
          <form className="mt-3 grid gap-3" onSubmit={(event) => void save(event)}>
            <label className="text-xs font-bold text-zinc-300">Título<input className="input mt-1" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} maxLength={80} /></label>
            <label className="text-xs font-bold text-zinc-300">Descripción<textarea className="input mt-1 min-h-20" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={600} /></label>
            <label className="text-xs font-bold text-zinc-300">Reglas<textarea className="input mt-1 min-h-24" value={form.rulesText} onChange={(event) => setForm((current) => ({ ...current, rulesText: event.target.value }))} maxLength={3000} /></label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-bold text-zinc-300">Banner image URL<input className="input mt-1" value={form.bannerImageUrl} onChange={(event) => setForm((current) => ({ ...current, bannerImageUrl: event.target.value }))} /></label>
              <label className="text-xs font-bold text-zinc-300">Banner image key<input className="input mt-1" value={form.bannerImageKey} onChange={(event) => setForm((current) => ({ ...current, bannerImageKey: event.target.value }))} /></label>
              <label className="text-xs font-bold text-zinc-300">Inicia<input className="input mt-1" placeholder="YYYY-MM-DD o ISO" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} /></label>
              <label className="text-xs font-bold text-zinc-300">Termina<input className="input mt-1" placeholder="YYYY-MM-DD o ISO" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} /></label>
              <label className="text-xs font-bold text-zinc-300">Tickets por burger<input className="input mt-1" type="number" min="0" step="1" value={form.ticketPerBurger} onChange={(event) => setForm((current) => ({ ...current, ticketPerBurger: event.target.value }))} /></label>
              <label className="text-xs font-bold text-zinc-300">Tickets por referido<input className="input mt-1" type="number" min="0" step="1" value={form.ticketPerReferral} onChange={(event) => setForm((current) => ({ ...current, ticketPerReferral: event.target.value }))} /></label>
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-sm font-bold text-zinc-200"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} /> Activar al guardar</label>
            {error ? <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}
            {notice ? <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">{notice}</p> : null}
            <div className="grid gap-2 sm:grid-cols-3">
              <Button className="bg-emerald-400 px-4 py-3 font-black text-emerald-950 disabled:opacity-50" disabled={saving}>{saving ? "Guardando…" : form.id ? "Guardar cambios" : "Crear sorteo"}</Button>
              {form.id && selectedCampaign ? <Button type="button" className="border border-zinc-700 bg-zinc-900 px-4 py-3 font-black disabled:opacity-50" disabled={saving} onClick={() => void activate(selectedCampaign, !selectedCampaign.isActive)}>{selectedCampaign.isActive ? "Desactivar" : "Activar"}</Button> : null}
              {form.id && selectedCampaign ? <Button type="button" className="border border-rose-500/40 bg-rose-500/10 px-4 py-3 font-black text-rose-100 disabled:opacity-50" disabled={saving} onClick={() => void deleteCampaign(selectedCampaign)}>Ocultar sorteo</Button> : null}
            </div>
          </form>
        </Card>

        <Card className="p-3">
          <div className="mb-3">
            <h3 className="font-black text-zinc-100">Imágenes del sorteo</h3>
            <p className="mt-1 text-xs text-zinc-400">Imágenes protegidas con sesión interna para campañas activas.</p>
          </div>
          <div className="grid gap-3">
            {renderImageBlock({ kind: "banner", title: "Banner horizontal", recommendation: "1600x900 px", preview: currentBannerPreview, currentKey: form.bannerImageKey, state: bannerUpload })}
            {renderImageBlock({ kind: "detail", title: "Imagen vertical de detalles", recommendation: "1080x1350 px", preview: currentDetailPreview, currentKey: form.detailImageKey, state: detailUpload })}
          </div>
        </Card>

        <Card className="p-3">
          <h3 className="font-black text-zinc-100">Códigos de invitado</h3>
          <form className="mt-3 grid gap-2" onSubmit={(event) => void createReferralCode(event)}>
            <label className="text-xs font-bold text-zinc-300">Nombre participante<input className="input mt-1" value={referralCodeForm.ownerName} onChange={(event) => setReferralCodeForm((current) => ({ ...current, ownerName: event.target.value }))} /></label>
            <label className="text-xs font-bold text-zinc-300">Teléfono participante<input className="input mt-1" inputMode="tel" value={referralCodeForm.ownerPhone} onChange={(event) => setReferralCodeForm((current) => ({ ...current, ownerPhone: event.target.value }))} /></label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-bold text-zinc-300">Palabra burger<select className="input mt-1" value={referralCodeForm.burgerWord} onChange={(event) => setReferralCodeForm((current) => ({ ...current, burgerWord: event.target.value as ReferralCodeForm["burgerWord"] }))}>{BURGER_WORDS.map((word) => <option key={word} value={word}>{word}</option>)}</select></label>
              <label className="text-xs font-bold text-zinc-300">Número 1–100<input className="input mt-1" type="number" min="1" max="100" step="1" value={referralCodeForm.number} onChange={(event) => setReferralCodeForm((current) => ({ ...current, number: event.target.value }))} /></label>
            </div>
            <Button className="bg-cyan-300 px-4 py-3 font-black text-cyan-950 disabled:opacity-50" disabled={saving || !selectedCampaign}>Crear código</Button>
          </form>
          {generatedCode ? <div className="mt-3 rounded-xl border border-cyan-400/40 bg-cyan-400/10 p-3 text-center"><p className="text-xs text-cyan-100">Código generado</p><strong className="text-2xl text-cyan-200">{generatedCode}</strong><Button type="button" className="mt-2 border border-cyan-400/40 px-3 py-2 text-xs" onClick={() => void navigator.clipboard?.writeText(generatedCode)}>Copiar código</Button></div> : null}
          <label className="mt-3 block text-xs font-bold text-zinc-300">Buscar códigos<input className="input mt-1" placeholder="Nombre, teléfono o código" value={codeSearch} onChange={(event) => setCodeSearch(event.target.value)} /></label>
          <div className="mt-3 space-y-2">
            {referralCodes.length ? referralCodes.map((code) => <div key={code.id} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-black text-zinc-50">{code.code}</p><p className="text-xs text-zinc-400">{code.ownerName} · {code.ownerPhoneMasked}</p></div><StatusPill className={code.isActive ? "border-emerald-400/40 text-emerald-200" : "border-zinc-700 text-zinc-400"}>{code.isActive ? "Activo" : "Inactivo"}</StatusPill></div><Button type="button" className="mt-2 border border-zinc-700 px-3 py-2 text-xs" disabled={saving} onClick={() => void toggleReferralCode(code)}>{code.isActive ? "Desactivar" : "Activar"}</Button></div>) : <p className="rounded-xl border border-zinc-800 p-3 text-sm text-zinc-400">Sin códigos para este sorteo.</p>}
          </div>
        </Card>

      </div>

      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-4"><p className="text-xs text-zinc-400">Total tickets</p><p className="text-3xl font-black text-emerald-300">{summary?.totalTickets ?? 0}</p></Card>
          <Card className="p-4"><p className="text-xs text-zinc-400">Participantes</p><p className="text-3xl font-black text-cyan-200">{summary?.totalParticipants ?? 0}</p></Card>
        </div>
        <Card className="p-3">
          <label className="text-xs font-bold text-zinc-300">Buscar participante<input className="input mt-1" placeholder="Nombre o últimos 4 dígitos" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <p className="mt-2 text-[11px] text-zinc-500">Busca por nombre, teléfono normalizado o últimos 4 dígitos. La respuesta/UI nunca muestra el teléfono completo.</p>
        </Card>
        <ParticipantList title="Resultados" participants={summary?.participantResults ?? []} empty={debouncedSearch ? "Sin participantes encontrados" : "Escribe nombre o últimos 4 dígitos para buscar."} onImage={setShareParticipant} />
        <ParticipantList title="Top usuarios por tickets" participants={summary?.topParticipants ?? []} empty="Aún no hay participantes con tickets para esta campaña." onImage={setShareParticipant} />
        <Card className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <label className="text-xs font-bold text-zinc-300">Buscar pedidos referidos<input className="input mt-1" placeholder="Código, nombre, teléfono o folio" value={referralSearch} onChange={(event) => setReferralSearch(event.target.value)} /></label>
            <label className="text-xs font-bold text-zinc-300">Filtro<select className="input mt-1" value={referralStatus} onChange={(event) => setReferralStatus(event.target.value as RaffleReferralStatus | "all")}><option value="all">Todos</option><option value="pending">Pendientes</option><option value="valid">Válidos</option><option value="invalid">Inválidos</option></select></label>
          </div>
          <div className="mt-3 space-y-2">
            {referrals.length ? referrals.map((referral) => <article key={referral.id} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"><div className="flex flex-col gap-2 sm:flex-row sm:justify-between"><div><p className="font-black text-zinc-50">{referral.code} · {referral.referredOrderFolio}</p><p className="text-xs text-zinc-400">Dueño: {referral.referrerName} ({referral.referrerPhoneMasked})</p><p className="text-xs text-zinc-400">Cliente referido: {referral.referredCustomerName} ({referral.referredCustomerPhoneMasked})</p><p className="text-xs text-zinc-500">{formatDateTime(referral.createdAt)} · {referral.ticketsAwarded} tickets</p>{referral.invalidReason ? <p className="text-xs text-rose-200">Razón: {referral.invalidReason}</p> : null}</div><StatusPill className={referral.status === "invalid" ? "border-rose-400/40 text-rose-200" : referral.status === "valid" ? "border-emerald-400/40 text-emerald-200" : "border-amber-400/40 text-amber-200"}>{referral.status}</StatusPill></div><div className="mt-2 grid gap-2 sm:grid-cols-3"><Button type="button" className="border border-emerald-500/40 px-3 py-2 text-xs" disabled={saving} onClick={() => void setReferralState(referral, "valid")}>Marcar válido</Button><Button type="button" className="border border-amber-500/40 px-3 py-2 text-xs" disabled={saving} onClick={() => void setReferralState(referral, "pending")}>Reabrir pendiente</Button><div><input className="input" placeholder="Razón para invalidar" value={invalidReasons[referral.id] ?? ""} onChange={(event) => setInvalidReasons((current) => ({ ...current, [referral.id]: event.target.value }))} /><Button type="button" className="mt-1 w-full border border-rose-500/40 px-3 py-2 text-xs" disabled={saving} onClick={() => void setReferralState(referral, "invalid")}>Invalidar</Button></div></div></article>) : <p className="rounded-xl border border-zinc-800 p-3 text-sm text-zinc-400">Sin pedidos referidos con esos filtros.</p>}
          </div>
        </Card>

        <Card className="p-3 text-xs text-zinc-400">
          <p className="font-bold text-zinc-200">Notas operativas</p>
          <p className="mt-1">Delivered sí cuenta; cancelled no cuenta. Referidos pending/valid suman; invalid no suma. La imagen para compartir usa teléfono enmascarado. Descarga la imagen y adjúntala manualmente en WhatsApp.</p>
        </Card>
      </div>
      {shareImageData ? <RaffleShareImageModal data={shareImageData} onClose={() => setShareParticipant(null)} /> : null}
    </section>
  );
};
