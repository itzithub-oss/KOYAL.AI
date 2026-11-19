"use client";

import { FormEvent, useMemo, useState } from "react";
import styles from "./FindUp.module.css";

type Business = {
  id: string; business_id: string; business_name: string; display_name?: string;
  category: string; subcategory?: string; description: string; status: string;
  services?: ({ name?: string; description?: string; keywords?: string[] } | string)[];
  keywords?: string[]; specialisations?: string[];
  location?: { full_address?: string; city?: string; district?: string; state?: string; pin_code?: string; maps_url?: string; service_areas?: string[] };
  pricing?: { starting_price?: string | number; consultation_fee?: string | number; pricing_type?: string; packages?: string };
  operations?: { public_contact_name?: string; business_phone?: string; whatsapp?: string; business_hours?: string };
  professionals?: { name?: string; degree?: string; qualifications?: string[]; specialisation?: string[]; experience_years?: number; registration_authority?: string; registration_number?: string; credentials_verified?: boolean }[];
  online_presence?: { website?: string; logo_url?: string; photo_urls?: string[] };
  verification_status?: string; submitted_at?: string; _matchReason?: string; branches?: string[]; category_details?: Record<string,unknown>;
};
const CATEGORIES = ["Healthcare","Education","Computer & Electronics","Food & Dining","Home & Local Services","Automotive","Beauty & Wellness","Professional Services","Other"];
const INITIAL_FORM: Record<string,string> = {
  business_name:"",display_name:"",category:"Healthcare",subcategory:"",description:"",
  owner_name:"",owner_phone:"",owner_email:"",designation:"",
  services:"",keywords:"",specialisations:"",city:"",district:"",state:"West Bengal",pin_code:"",
  full_address:"",maps_url:"",service_areas:"",business_phone:"",whatsapp:"",public_contact_name:"",
  business_hours:"",website:"",starting_price:"",consultation_fee:"",pricing_type:"Fixed / Starting from",
  operating_person:"",establishment_year:"",professional_name:"",degree:"",qualifications:"",
  professional_specialisation:"",experience_years:"",registration_authority:"",registration_number:"",
  additional_professionals_json:"",branches:"",latitude:"",longitude:"",max_price:"",packages:"",social_links:"",logo_url:"",photo_urls:"",
  education_levels:"",subjects:"",restaurant_cuisine:"",delivery:"",other_details:"",
};
const splitLines = (value:string) => value.split(/[\n,]/).map((item)=>item.trim()).filter(Boolean);
const safeUrl = (value:string) => /^https?:\/\//i.test(value) ? value : "";
const mapsUrl = (business:Business) => safeUrl(business.location?.maps_url || "") || (business.location?.full_address || business.location?.city ? "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent([business.display_name || business.business_name,business.location?.full_address,business.location?.city,business.location?.state].filter(Boolean).join(", ")) : "");
const publicPhone = (business:Business) => business.operations?.business_phone || "";
const publicWhatsapp = (business:Business) => (business.operations?.whatsapp || "").replace(/\D/g,"");

export default function FindUp({ onClose }: { onClose: () => void }) {
  const [tab,setTab] = useState<"discover"|"join"|"admin">("discover");
  const [query,setQuery] = useState("");
  const [location,setLocation] = useState("");
  const [category,setCategory] = useState("");
  const [maxPrice,setMaxPrice] = useState("");
  const [results,setResults] = useState<Business[]>([]);
  const [searched,setSearched] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [selected,setSelected] = useState<Business|null>(null);
  const [form,setForm] = useState(INITIAL_FORM);
  const [formBusy,setFormBusy] = useState(false);
  const [formNotice,setFormNotice] = useState("");
  const [formError,setFormError] = useState("");
  const [adminRows,setAdminRows] = useState<Business[]>([]);
  const [adminToken,setAdminToken] = useState("");
  const [adminError,setAdminError] = useState("");
  const [adminBusy,setAdminBusy] = useState(false);
  const [adminFilter,setAdminFilter] = useState("ALL");
  const [editJson,setEditJson] = useState("");
  const [editingId,setEditingId] = useState("");

  const filteredAdmin = useMemo(()=>adminRows.filter((row)=>adminFilter==="ALL" || row.status===adminFilter),[adminRows,adminFilter]);
  const updateForm = (key:string,value:string) => setForm((old)=>({...old,[key]:value}));

  async function searchBusinesses(event?:FormEvent) {
    event?.preventDefault();
    if(!query.trim() && !location.trim() && !category) { setError("Enter a service, business type or location to search."); return; }
    setBusy(true); setError(""); setSearched(true); setSelected(null);
    try {
      const params = new URLSearchParams({q:query,location,category,maxPrice});
      const response = await fetch("/api/find-up?"+params.toString(),{cache:"no-store"});
      const data = await response.json();
      if(!response.ok) throw new Error(data.error || "Search is temporarily unavailable.");
      setResults(Array.isArray(data.businesses)?data.businesses:[]);
    } catch(cause) { setResults([]); setError(cause instanceof Error?cause.message:"Find Up could not complete the search."); }
    finally { setBusy(false); }
  }

  function clearSearch() {
    setQuery("");setLocation("");setCategory("");setMaxPrice("");setResults([]);setSearched(false);setError("");setSelected(null);
  }

  async function submitApplication(event:FormEvent) {
    event.preventDefault();setFormBusy(true);setFormError("");setFormNotice("");
    const services=splitLines(form.services).map((name)=>({name,description:"",keywords:[]}));
    let additionalProfessionals: any[] = [];
    try { additionalProfessionals = form.additional_professionals_json.trim() ? JSON.parse(form.additional_professionals_json) : []; if (!Array.isArray(additionalProfessionals)) throw new Error("Additional professionals must be a JSON array."); }
    catch { setFormError("Additional professional details must be a valid JSON array."); setFormBusy(false); return; }
    const professionals=form.category==="Healthcare" && form.professional_name.trim()?[{
      name:form.professional_name,degree:form.degree,qualifications:splitLines(form.qualifications),
      specialisation:splitLines(form.professional_specialisation),experience_years:form.experience_years?Number(form.experience_years):null,
      registration_authority:form.registration_authority,registration_number:form.registration_number,
    }]:[];
    const categoryDetails=form.category==="Education"?{education_levels:splitLines(form.education_levels),subjects:splitLines(form.subjects)}:
      form.category==="Food & Dining"?{cuisine:form.restaurant_cuisine,delivery:form.delivery}:
      {details:form.other_details};
    try {
      const response=await fetch("/api/find-up",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({business:{
        ...form,services,keywords:splitLines(form.keywords),specialisations:splitLines(form.specialisations),
        service_areas:splitLines(form.service_areas),latitude:form.latitude,longitude:form.longitude,branches:splitLines(form.branches),professionals,\n        pricing:{starting_price:form.starting_price,maximum_price:form.max_price,consultation_fee:form.consultation_fee,pricing_type:form.pricing_type,packages:form.packages},\n        social_links:splitLines(form.social_links),logo_url:form.logo_url,photo_urls:splitLines(form.photo_urls),operating_person:form.operating_person,
        category_details:categoryDetails,
      }})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Could not submit your application.");
      setFormNotice((data.message||"Application submitted.")+(data.businessId?" Your reference ID: "+data.businessId:""));
      setForm(INITIAL_FORM);
    } catch(cause) {setFormError(cause instanceof Error?cause.message:"Application submission failed.");}
    finally {setFormBusy(false);}
  }

  async function loadAdmin() {
    setAdminBusy(true);setAdminError("");
    try {
      const raw=localStorage.getItem("koyal-ai-auth-session");
      const session=raw?JSON.parse(raw):null;
      if(!session?.access_token) throw new Error("Sign in with an authorised KOYAL account to access administration.");
      setAdminToken(session.access_token);
      const response=await fetch("/api/find-up/admin",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Admin access denied.");
      setAdminRows(Array.isArray(data.businesses)?data.businesses:[]);
    } catch(cause) {setAdminError(cause instanceof Error?cause.message:"Could not load admin applications.");}
    finally {setAdminBusy(false);}
  }

  async function adminAction(row:Business,action:string) {
    if(action==="DELETE" && !window.confirm("Permanently delete this business application?")) return;
    setAdminBusy(true);setAdminError("");
    try {
      const response=action==="DELETE"
        ? await fetch("/api/find-up/admin?id="+encodeURIComponent(row.id),{method:"DELETE",headers:{Authorization:"Bearer "+adminToken}})
        : await fetch("/api/find-up/admin",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:"Bearer "+adminToken},body:JSON.stringify({id:row.id,action})});
      const data=action==="DELETE"?{}:await response.json();
      if(!response.ok) throw new Error(data.error||"Admin update failed.");
      if(action==="DELETE") setAdminRows((old)=>old.filter((item)=>item.id!==row.id));
      else setAdminRows((old)=>old.map((item)=>item.id===row.id?data.business:item));
    } catch(cause) {setAdminError(cause instanceof Error?cause.message:"Could not update this listing.");}
    finally {setAdminBusy(false);}
  }

  async function saveAdminEdit(row:Business) {
    setAdminBusy(true);setAdminError("");
    try {
      const updates=JSON.parse(editJson);
      const response=await fetch("/api/find-up/admin",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:"Bearer "+adminToken},body:JSON.stringify({id:row.id,action:"EDIT",updates})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Could not save edits.");
      setAdminRows((old)=>old.map((item)=>item.id===row.id?data.business:item));setEditingId("");setEditJson("");
    } catch(cause) {setAdminError(cause instanceof Error?cause.message:"Invalid edit JSON.");}
    finally {setAdminBusy(false);}
  }

  const title=(business:Business)=>business.display_name||business.business_name;
  const renderCard=(business:Business)=> <article className={styles.businessCard} key={business.id}>
    <div className={styles.cardTop}>
      {business.online_presence?.logo_url&&safeUrl(business.online_presence.logo_url)?<img className={styles.logo} src={safeUrl(business.online_presence.logo_url)} alt="" />:<div className={styles.logoFallback}>{title(business).slice(0,1).toUpperCase()}</div>}
      <div className={styles.cardTitle}><h3>{title(business)}</h3><p>{business.category}{business.subcategory?" · "+business.subcategory:""}</p></div>
      {business.verification_status==="VERIFIED"&&<span className={styles.verified}>Verified</span>}
    </div>
    <p className={styles.description}>{business.description}</p>
    <div className={styles.chips}>{(business.services||[]).slice(0,4).map((service,index)=><span key={index}>{typeof service==="string"?service:service.name}</span>)}</div>
    <div className={styles.cardMeta}>
      <span>⌖ {[business.location?.city,business.location?.district,business.location?.state].filter(Boolean).join(", ")||"Location not provided"}</span>
      {business.pricing?.starting_price&&<span>From ₹{business.pricing.starting_price}</span>}
    </div>
    {business._matchReason&&<p className={styles.matchReason}>{business._matchReason}</p>}
    <div className={styles.cardActions}>
      {publicPhone(business)&&<a href={"tel:"+publicPhone(business)}>Call Now</a>}
      {publicWhatsapp(business)&&<a href={"https://wa.me/"+publicWhatsapp(business)} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
      {mapsUrl(business)&&<a href={mapsUrl(business)} target="_blank" rel="noopener noreferrer">View Location</a>}
      {safeUrl(business.online_presence?.website||"")&&<a href={safeUrl(business.online_presence?.website||"")} target="_blank" rel="noopener noreferrer">Website</a>}
      <button type="button" onClick={()=>setSelected(business)}>View Details</button>
    </div>
  </article>;

  return <section className={styles.shell} aria-label="Find Up business discovery">
    <header className={styles.header}>
      <div><div className={styles.eyebrow}><span/> KOYAL PARTNERSHIP NETWORK</div><h1>FIND <em>UP</em></h1><p>Find the Right Service. Find the Right Business.</p></div>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Close Find Up">×</button>
    </header>
    <nav className={styles.tabs} aria-label="Find Up sections">
      <button className={tab==="discover"?styles.activeTab:""} onClick={()=>setTab("discover")} type="button">Discover</button>
      <button className={tab==="join"?styles.activeTab:""} onClick={()=>setTab("join")} type="button">Join Partnership</button>
      <button className={tab==="admin"?styles.activeTab:""} onClick={()=>{setTab("admin");if(!adminRows.length&&!adminError)void loadAdmin();}} type="button">Admin</button>
    </nav>

    {tab==="discover"&&<div className={styles.content}>
      <div className={styles.hero}><div className={styles.heroMark}>⌕</div><h2>Find the Right Service. <span>Find the Right Business.</span></h2><p>Tell KOYAL what you're looking for. We'll help you discover relevant registered businesses.</p>
        <form className={styles.searchForm} onSubmit={searchBusinesses}>
          <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="What service or business are you looking for?" aria-label="Search for a business or service"/>
          <button type="submit" disabled={busy}>{busy?"Searching…":"Search"}</button>
          <button type="button" className={styles.clearButton} onClick={clearSearch}>Clear</button>
        </form>
        <div className={styles.filters}>
          <label>Location<input value={location} onChange={(e)=>setLocation(e.target.value)} placeholder="City, district or PIN"/></label>
          <label>Service category<select value={category} onChange={(e)=>setCategory(e.target.value)}><option value="">All categories</option>{CATEGORIES.map((item)=><option key={item}>{item}</option>)}</select></label>
          <label>Maximum price (₹)<input value={maxPrice} onChange={(e)=>setMaxPrice(e.target.value)} type="number" min="0" placeholder="Optional"/></label>
        </div>
        <div className={styles.suggestions}><span>Try:</span>{["Physiotherapist for back pain","Laptop repair shop","Mathematics tutor for Class 8","Restaurant with home delivery"].map((item)=><button type="button" key={item} onClick={()=>{setQuery(item);setCategory("");}}>{item}</button>)}</div>
      </div>
      {error&&<p className={styles.error} role="alert">{error}</p>}
      {busy&&<p className={styles.status}>Searching approved partnership listings…</p>}
      {!busy&&searched&&<div className={styles.results}><div className={styles.resultsHead}><h2>Search results</h2><span>{results.length} matching business{results.length===1?"":"es"}</span></div>
        {results.length? <div className={styles.resultGrid}>{results.map(renderCard)}</div>:<div className={styles.empty}><strong>No matching registered business was found.</strong><p>Try another service or location. Find Up only lists businesses approved for the KOYAL Partnership Program.</p></div>}
      </div>}
      {!searched&&<div className={styles.emptyHint}>Search only the approved KOYAL Partnership Program directory. No sponsored or invented listings.</div>}
    </div>}

    {tab==="join"&&<div className={styles.content}>
      <div className={styles.sectionIntro}><h2>Become a KOYAL partner</h2><p>Submit your business details. Every application is reviewed before it can appear in public search.</p></div>
      <form className={styles.application} onSubmit={submitApplication}>
        <h3>Business details</h3>
        <div className={styles.formGrid}>
          <label>Registered business name *<input required value={form.business_name} onChange={e=>updateForm("business_name",e.target.value)} /></label>
          <label>Public display name<input value={form.display_name} onChange={e=>updateForm("display_name",e.target.value)} /></label>
          <label>Category *<select value={form.category} onChange={e=>updateForm("category",e.target.value)}>{CATEGORIES.map(item=><option key={item}>{item}</option>)}</select></label>
          <label>Subcategory<input value={form.subcategory} onChange={e=>updateForm("subcategory",e.target.value)} placeholder="e.g. Sports physiotherapy"/></label>
          <label className={styles.wide}>Business description *<textarea required minLength={20} rows={3} value={form.description} onChange={e=>updateForm("description",e.target.value)} /></label>
          <label>Year established<input type="number" min="1800" max={new Date().getFullYear()} value={form.establishment_year} onChange={e=>updateForm("establishment_year",e.target.value)} /></label>
          <label>Operating status<select value={form.operating_status} onChange={e=>updateForm("operating_status",e.target.value)}><option>Operating</option><option>Temporarily closed</option><option>Seasonal</option></select></label>
          <label className={styles.wide}>Services offered * (one per line)<textarea required rows={3} value={form.services} onChange={e=>updateForm("services",e.target.value)} placeholder="Physiotherapy assessment&#10;Sports injury rehabilitation"/></label>
          <label>Search keywords (comma separated)<input value={form.keywords} onChange={e=>updateForm("keywords",e.target.value)} /></label>
          <label>Specialisations (comma separated)<input value={form.specialisations} onChange={e=>updateForm("specialisations",e.target.value)} /></label>
        </div>
        {form.category==="Healthcare"&&<><h3>Healthcare professional details</h3><p className={styles.note}>Credentials are not shown as verified unless an administrator reviews them.</p><div className={styles.formGrid}>
          <label>Professional name<input value={form.professional_name} onChange={e=>updateForm("professional_name",e.target.value)} /></label>
          <label>Degree<input value={form.degree} onChange={e=>updateForm("degree",e.target.value)} /></label>
          <label>Qualifications<input value={form.qualifications} onChange={e=>updateForm("qualifications",e.target.value)} placeholder="Separate with commas"/></label>
          <label>Specialisation<input value={form.professional_specialisation} onChange={e=>updateForm("professional_specialisation",e.target.value)} /></label>
          <label>Years of experience<input type="number" min="0" max="80" value={form.experience_years} onChange={e=>updateForm("experience_years",e.target.value)} /></label>
          <label>Registration authority<input value={form.registration_authority} onChange={e=>updateForm("registration_authority",e.target.value)} /></label>
          <label>Registration number<input value={form.registration_number} onChange={e=>updateForm("registration_number",e.target.value)} /></label>
        </div></>}
        {form.category==="Education"&&<><h3>Education details</h3><div className={styles.formGrid}><label>Classes / levels<input value={form.education_levels} onChange={e=>updateForm("education_levels",e.target.value)} placeholder="e.g. Class 6–10"/></label><label>Subjects<input value={form.subjects} onChange={e=>updateForm("subjects",e.target.value)} /></label></div></>}
        {form.category==="Food & Dining"&&<><h3>Restaurant details</h3><div className={styles.formGrid}><label>Cuisine / food type<input value={form.restaurant_cuisine} onChange={e=>updateForm("restaurant_cuisine",e.target.value)} /></label><label>Delivery availability<input value={form.delivery} onChange={e=>updateForm("delivery",e.target.value)} placeholder="e.g. Home delivery / takeaway"/></label></div></>}
        {form.category!=="Healthcare"&&form.category!=="Education"&&form.category!=="Food & Dining"&&<><h3>Additional service details</h3><label className={styles.wide}>Other relevant details<textarea rows={2} value={form.other_details} onChange={e=>updateForm("other_details",e.target.value)} /></label></>}
        <h3>Location and contact</h3><div className={styles.formGrid}>
          <label>Full business address<input value={form.full_address} onChange={e=>updateForm("full_address",e.target.value)} /></label>
          <label>City *<input required value={form.city} onChange={e=>updateForm("city",e.target.value)} /></label>
          <label>District<input value={form.district} onChange={e=>updateForm("district",e.target.value)} /></label>
          <label>State *<input required value={form.state} onChange={e=>updateForm("state",e.target.value)} /></label>
          <label>PIN code<input value={form.pin_code} onChange={e=>updateForm("pin_code",e.target.value)} /></label>
          <label>Service areas<input value={form.service_areas} onChange={e=>updateForm("service_areas",e.target.value)} /></label>\n          <label className={styles.wide}>Branch addresses (one per line)<textarea rows={2} value={form.branches} onChange={e=>updateForm("branches",e.target.value)} /></label>\n          <label>Latitude<input value={form.latitude} onChange={e=>updateForm("latitude",e.target.value)} /></label><label>Longitude<input value={form.longitude} onChange={e=>updateForm("longitude",e.target.value)} /></label>
          <label>Business contact number<input type="tel" value={form.business_phone} onChange={e=>updateForm("business_phone",e.target.value)} /></label>
          <label>WhatsApp number<input type="tel" value={form.whatsapp} onChange={e=>updateForm("whatsapp",e.target.value)} /></label>
          <label>Public contact person's name<input value={form.public_contact_name} onChange={e=>updateForm("public_contact_name",e.target.value)} /></label>
          <label>Operating person<input value={form.operating_person} onChange={e=>updateForm("operating_person",e.target.value)} /></label>\n          <label>Business hours<input value={form.business_hours} onChange={e=>updateForm("business_hours",e.target.value)} /></label>
          <label>Google Maps URL<input type="url" value={form.maps_url} onChange={e=>updateForm("maps_url",e.target.value)} /></label>
          <label>Website URL<input type="url" value={form.website} onChange={e=>updateForm("website",e.target.value)} /></label>\n          <label>Logo URL<input type="url" value={form.logo_url} onChange={e=>updateForm("logo_url",e.target.value)} /></label>\n          <label>Social media links (one per line)<textarea rows={2} value={form.social_links} onChange={e=>updateForm("social_links",e.target.value)} /></label>\n          <label>Business photo URLs (one per line)<textarea rows={2} value={form.photo_urls} onChange={e=>updateForm("photo_urls",e.target.value)} /></label>
        </div>
        <h3>Pricing</h3><div className={styles.formGrid}>
          <label>Starting price (₹)<input type="number" min="0" value={form.starting_price} onChange={e=>updateForm("starting_price",e.target.value)} /></label>
          <label>Maximum price (₹)<input type="number" min="0" value={form.max_price} onChange={e=>updateForm("max_price",e.target.value)} /></label>\n          <label>Consultation fee (₹)<input type="number" min="0" value={form.consultation_fee} onChange={e=>updateForm("consultation_fee",e.target.value)} /></label>\n          <label className={styles.wide}>Packages / pricing notes<textarea rows={2} value={form.packages} onChange={e=>updateForm("packages",e.target.value)} /></label>
          <label>Pricing type<select value={form.pricing_type} onChange={e=>updateForm("pricing_type",e.target.value)}><option>Fixed / Starting from</option><option>Hourly</option><option>Per session</option><option>Quote required</option></select></label>
        </div>
        <h3>Owner / applicant (private)</h3><div className={styles.formGrid}>
          <label>Owner name *<input required value={form.owner_name} onChange={e=>updateForm("owner_name",e.target.value)} /></label>
          <label>Owner phone *<input required type="tel" value={form.owner_phone} onChange={e=>updateForm("owner_phone",e.target.value)} /></label>
          <label>Owner email<input type="email" value={form.owner_email} onChange={e=>updateForm("owner_email",e.target.value)} /></label>
          <label>Designation<input value={form.designation} onChange={e=>updateForm("designation",e.target.value)} /></label>
        </div>
        <p className={styles.privacy}>By submitting, you confirm that the information is accurate and that KOYAL may contact you to review this application. Owner contact details are private and are not displayed in public search.</p>
        {formError&&<p className={styles.error} role="alert">{formError}</p>}{formNotice&&<p className={styles.success} role="status">{formNotice}</p>}
        <button className={styles.primary} type="submit" disabled={formBusy}>{formBusy?"Submitting…":"Submit partnership application"}</button>
      </form>
    </div>}

    {tab==="admin"&&<div className={styles.content}>
      <div className={styles.sectionIntro}><h2>Partnership administration</h2><p>Review submissions, approve public listings and verify professional credentials separately.</p><button className={styles.secondary} type="button" onClick={loadAdmin} disabled={adminBusy}>Refresh applications</button></div>
      {adminError&&<p className={styles.error} role="alert">{adminError}</p>}
      <div className={styles.adminFilters}><label>Application status<select value={adminFilter} onChange={e=>setAdminFilter(e.target.value)}>{["ALL","PENDING","UNDER REVIEW","APPROVED","REJECTED","NEEDS CORRECTION","SUSPENDED"].map(item=><option key={item}>{item}</option>)}</select></label><span>{filteredAdmin.length} application(s)</span></div>
      {adminBusy&&!adminRows.length?<p className={styles.status}>Loading admin records…</p>:filteredAdmin.map(row=><article className={styles.adminCard} key={row.id}>
        <div className={styles.adminHead}><div><strong>{row.display_name||row.business_name}</strong><small>{row.business_id} · {row.category} · {row.location?.city||"No city"}</small></div><span className={styles.statusPill}>{row.status}</span></div>
        <p>{row.description}</p><small>Submitted {row.submitted_at?new Date(row.submitted_at).toLocaleString():"—"} · Credentials: {row.verification_status||"UNVERIFIED"}</small>
        {editingId===row.id?<div className={styles.editArea}><textarea rows={8} value={editJson} onChange={e=>setEditJson(e.target.value)} /><button type="button" onClick={()=>saveAdminEdit(row)} disabled={adminBusy}>Save edits</button><button type="button" className={styles.secondary} onClick={()=>setEditingId("")}>Cancel</button></div>:<div className={styles.adminActions}>
          <button type="button" onClick={()=>adminAction(row,"UNDER REVIEW")}>Under review</button>
          <button type="button" onClick={()=>adminAction(row,"APPROVED")}>Approve</button>
          <button type="button" onClick={()=>adminAction(row,"NEEDS CORRECTION")}>Request correction</button>
          <button type="button" onClick={()=>adminAction(row,"REJECTED")}>Reject</button>
          <button type="button" onClick={()=>adminAction(row,row.status==="SUSPENDED"?"APPROVED":"SUSPENDED")}>{row.status==="SUSPENDED"?"Reactivate":"Suspend"}</button>
          <button type="button" onClick={()=>adminAction(row,row.verification_status==="VERIFIED"?"UNVERIFY_CREDENTIALS":"VERIFY_CREDENTIALS")}>{row.verification_status==="VERIFIED"?"Unverify credentials":"Verify credentials"}</button>
          <button type="button" onClick={()=>{setEditingId(row.id);setEditJson(JSON.stringify({business_name:row.business_name,display_name:row.display_name,category:row.category,subcategory:row.subcategory,description:row.description,services:row.services,keywords:row.keywords,specialisations:row.specialisations,branches:row.branches,category_details:row.category_details,location:row.location,pricing:row.pricing,operations:row.operations,professionals:row.professionals,online_presence:row.online_presence},null,2));}}>Edit JSON</button>
          <button type="button" className={styles.danger} onClick={()=>adminAction(row,"DELETE")}>Delete</button>
        </div>}
      </article>)}
      {!adminBusy&&!adminRows.length&&!adminError&&<p className={styles.emptyHint}>No applications loaded yet.</p>}
    </div>}

    {selected&&<div className={styles.modalShade} role="presentation" onClick={()=>setSelected(null)}><section className={styles.detailModal} role="dialog" aria-modal="true" aria-label={title(selected)+" details"} onClick={e=>e.stopPropagation()}>
      <button className={styles.close} type="button" onClick={()=>setSelected(null)} aria-label="Close details">×</button>
      <div className={styles.eyebrow}>REGISTERED PARTNER · {selected.business_id}</div><h2>{title(selected)}</h2><p>{selected.category}{selected.subcategory?" · "+selected.subcategory:""}</p>
      {selected.verification_status==="VERIFIED"&&<span className={styles.verified}>Credentials reviewed</span>}
      <h3>Overview</h3><p>{selected.description}</p>
      <h3>Services</h3><ul>{(selected.services||[]).map((service,index)=><li key={index}>{typeof service==="string"?service:service.name}{typeof service==="object"&&service.description?" — "+service.description:""}</li>)}</ul>
      <h3>Pricing</h3><p>{selected.pricing?.starting_price?"Starting from ₹"+selected.pricing.starting_price:"Starting price not provided"}{selected.pricing?.consultation_fee?" · Consultation ₹"+selected.pricing.consultation_fee:""}{selected.pricing?.pricing_type?" · "+selected.pricing.pricing_type:""}</p>
      {selected.category==="Healthcare"&&<><h3>Professional details</h3>{(selected.professionals||[]).filter(person=>person.credentials_verified&&selected.verification_status==="VERIFIED").map((person,index)=><p key={index}><strong>{person.name}</strong>{person.degree?" · "+person.degree:""}{person.specialisation?.length?" · "+person.specialisation.join(", "):""}{person.experience_years!=null?" · "+person.experience_years+" years' experience":""}{person.registration_authority?" · "+person.registration_authority:""}</p>)}{!(selected.professionals||[]).some(person=>person.credentials_verified&&selected.verification_status==="VERIFIED")&&<p>Professional credentials have not been verified for public display.</p>}</>}
      <h3>Location</h3><p>{[selected.location?.full_address,selected.location?.city,selected.location?.district,selected.location?.state,selected.location?.pin_code].filter(Boolean).join(", ")||"Location not provided"}</p>{selected.branches?.length?<ul>{selected.branches.map((branch,index)=><li key={index}>{branch}</li>)}</ul>:null}\n      {selected.category_details&&Object.keys(selected.category_details).length>0&&<><h3>Additional service information</h3><p>{JSON.stringify(selected.category_details)}</p></>}
      <h3>Contact and hours</h3><p>{selected.operations?.public_contact_name||""}{selected.operations?.business_phone?" · "+selected.operations.business_phone:""}{selected.operations?.business_hours?" · "+selected.operations.business_hours:""}</p>
      <div className={styles.cardActions}>{publicPhone(selected)&&<a href={"tel:"+publicPhone(selected)}>Call Now</a>}{publicWhatsapp(selected)&&<a href={"https://wa.me/"+publicWhatsapp(selected)} target="_blank" rel="noopener noreferrer">WhatsApp</a>}{mapsUrl(selected)&&<a href={mapsUrl(selected)} target="_blank" rel="noopener noreferrer">View Location</a>}{safeUrl(selected.online_presence?.website||"")&&<a href={safeUrl(selected.online_presence?.website||"")} target="_blank" rel="noopener noreferrer">Visit Website</a>}</div>
    </section></div>}
  </section>;
}
