import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { CreateRaffleCampaignPayload, RaffleCampaignV2, RaffleParticipantSummary, RaffleReferralCodeV2, RaffleReferralStatus, RaffleReferralV2, RaffleSummaryResponse } from "@config/index";
import { Button, Card, StatusPill } from "@ui/index";
import { createRaffleCampaignV2, createRaffleReferralCodeV2, fetchRaffleCampaignsV2, fetchRaffleReferralCodesV2, fetchRaffleReferralsV2, fetchRaffleSummaryV2, updateRaffleCampaignV2, updateRaffleReferralCodeV2, updateRaffleReferralV2 } from "../lib/raffles-v2-admin";

type RaffleSummary = NonNullable<RaffleSummaryResponse["data"]>;
type RaffleForm = {
  id?: string;
  title: string;
  description: string;
  rulesText: string;
  bannerImageUrl: string;
  bannerImageKey: string;
  startsAt: string;
  endsAt: string;
  ticketPerBurger: string;
  ticketPerReferral: string;
  isActive: boolean;
};

const BURGER_WORDS = ["BURGER", "SMASH", "BACON", "PICKLES", "CHEESE", "FRIES"] as const;

type ReferralCodeForm = { ownerName: string; ownerPhone: string; burgerWord: typeof BURGER_WORDS[number]; number: string };
const emptyReferralCodeForm = (): ReferralCodeForm => ({ ownerName: "", ownerPhone: "", burgerWord: "BURGER", number: "27" });

const emptyForm = (): RaffleForm => ({
  title: "",
  description: "",
  rulesText: "",
  bannerImageUrl: "",
  bannerImageKey: "",
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

const ParticipantList = ({ title, participants, empty }: { title: string; participants: RaffleParticipantSummary[]; empty: string }) => (
  <Card className="p-3">
    <h3 className="text-sm font-black text-zinc-100">{title}</h3>
    <div className="mt-3 space-y-2">
      {participants.length ? participants.map((participant) => (
        <div key={participantKey(participant)} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-black text-zinc-50">{participant.customerName}</p>
              <p className="text-xs text-zinc-400">{participant.customerPhoneMasked} · Último folio {participant.lastOrderFolio || "—"}</p>
              <p className="text-xs text-zinc-500">Último pedido: {formatDateTime(participant.lastOrderAt)}</p>
            </div>
            <strong className="text-2xl font-black text-emerald-300">{participant.totalTickets}</strong>
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

  const activeCampaign = useMemo(() => campaigns.find((campaign) => campaign.isActive) ?? null, [campaigns]);
  const selectedCampaign = useMemo(() => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? activeCampaign, [activeCampaign, campaigns, selectedCampaignId]);

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
    return {
      title,
      description: form.description.trim() || undefined,
      rulesText: form.rulesText.trim() || undefined,
      bannerImageUrl: form.bannerImageUrl.trim() || undefined,
      bannerImageKey: form.bannerImageKey.trim() || undefined,
      startsAt: form.startsAt.trim() || undefined,
      endsAt: form.endsAt.trim() || undefined,
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

  return (
    <section className="grid gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
      <div className="space-y-3">
        <Card className="p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-emerald-200">Sorteos V2</p>
              <h2 className="text-xl font-black text-zinc-50">Campañas mensuales</h2>
              <p className="mt-1 text-xs text-zinc-400">Fase 4B: 1 ticket por burger/combo y 2 tickets por amigo invitado.</p>
            </div>
            <Button className="border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs" onClick={() => void reload()} disabled={loading}>Recargar</Button>
          </div>
          {activeCampaign ? (
            <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3">
              <p className="text-xs font-bold text-emerald-100">Activa ahora</p>
              <p className="font-black text-zinc-50">{activeCampaign.title}</p>
              <p className="text-xs text-zinc-400">{activeCampaign.ticketPerBurger} ticket por burger · Referidos: fase 4B</p>
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
            <div className="grid gap-2 sm:grid-cols-2">
              <Button className="bg-emerald-400 px-4 py-3 font-black text-emerald-950 disabled:opacity-50" disabled={saving}>{saving ? "Guardando…" : form.id ? "Guardar cambios" : "Crear sorteo"}</Button>
              {form.id && selectedCampaign ? <Button type="button" className="border border-zinc-700 bg-zinc-900 px-4 py-3 font-black disabled:opacity-50" disabled={saving} onClick={() => void activate(selectedCampaign, !selectedCampaign.isActive)}>{selectedCampaign.isActive ? "Desactivar" : "Activar"}</Button> : null}
            </div>
          </form>
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
        <ParticipantList title="Resultados" participants={summary?.participantResults ?? []} empty={debouncedSearch ? "Sin participantes encontrados" : "Escribe nombre o últimos 4 dígitos para buscar."} />
        <ParticipantList title="Top usuarios por tickets" participants={summary?.topParticipants ?? []} empty="Aún no hay participantes con tickets para esta campaña." />
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
          <p className="font-bold text-zinc-200">Notas operativas Fase 4A</p>
          <p className="mt-1">Delivered sí cuenta; cancelled no cuenta. Referidos pending/valid suman; invalid no suma. Self-referral e inválidos no bloquean pedidos. Imagen brandeada/WhatsApp queda para Fase 4C.</p>
        </Card>
      </div>
    </section>
  );
};
