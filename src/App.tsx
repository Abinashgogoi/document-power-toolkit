import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowUp, BookOpenText, Boxes, Check, CheckCircle2, ChevronRight,
  CircleAlert, Combine, Download, FileImage, FileOutput, Files, Fingerprint, Gauge, History,
  ImageDown, ImagePlus, Info, Languages, Layers3, LayoutGrid, ListFilter, LoaderCircle,
  LockKeyhole, Menu, PanelLeftClose, Plus, RefreshCw, RotateCw, ScanSearch, Scissors,
  Search, Settings, ShieldCheck, Split, Stamp, Trash2, UserRound, Wand2, X,
} from 'lucide-react';
import { PdfViewer } from './components/PdfViewer';
import { FilePreviewGallery } from './components/FilePreviewGallery';
import { PdfPageGrid } from './components/PdfPageGrid';
import {
  addBlankPages, addPageNumbers, addWatermark, cleanPdfMetadata, compressPdf,
  deletePdfPages, duplicatePdfPages, extractPdfPages, imagesToPdf, mergePdfs,
  pdfPageCount, pdfToImages, reorderPdfPages, rotatePdf, splitPdf,
} from './engine/pdf-engine';
import { compressImage, resizeImage } from './engine/image-engine';
import { inspectPdf, inspectPdfSignatures, pdfToText } from './engine/document-engine';
import { runOcr, type OcrLanguage } from './engine/ocr-engine';
import { clearHistory, getHistory, getLocalProfile, saveHistory, saveLocalProfile } from './lib/history';
import {
  appendSelectedFiles, downloadBlob, humanBytes, parseOrderedPageSelection, parsePageSelection,
} from './lib/files';
import { errorMessage } from './lib/verification';
import { classifyProcessingError, shouldReportProcessingError } from './lib/diagnostics';
import {
  emptyCloudState, loadCloudState, onAuthChange, signIn, signOut, signUp,
  submitDiagnostic, subscribeControlPlane, supabaseConfigured, syncHistoryEntry, updateDisplayName, type CloudState,
} from './backend/supabase';
import { CATEGORY_LABELS, TOOLS } from './tools';
import type {
  CompressionOptions, HistoryEntry, LocalProfile, ProcessingResult, QualityFloor,
  ToolCategory, ToolDefinition, ToolId,
} from './types';

const TOOL_ICONS: Record<ToolId, typeof Combine> = {
  merge: Combine, split: Split, rotate: RotateCw, extract: Scissors,
  'delete-pages': Trash2, 'reorder-pages': ListFilter, 'duplicate-pages': Files,
  'add-blank-page': Plus, 'images-to-pdf': ImagePlus, 'pdf-to-images': Layers3,
  'pdf-to-text': BookOpenText, 'compress-pdf': Gauge, 'compress-image': ImageDown,
  'resize-image': FileImage, watermark: Stamp, 'page-numbers': Boxes,
  'clean-metadata': ShieldCheck, 'inspect-pdf': Info, ocr: Languages,
  'signature-inspect': Fingerprint,
};

type CategoryFilter = ToolCategory | 'all';

export default function App() {
  const [activeToolId, setActiveToolId] = useState<ToolId | null>(null);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ message: '', percent: 0 });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [view, setView] = useState<'tools' | 'history'>('tools');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [cloudState, setCloudState] = useState<CloudState>(emptyCloudState);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudError, setCloudError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [rotation, setRotation] = useState(90);
  const [pages, setPages] = useState('1');
  const [pageOrder, setPageOrder] = useState('');
  const [blankCount, setBlankCount] = useState(1);
  const [blankSize, setBlankSize] = useState<'a4' | 'letter' | 'match'>('match');
  const [target, setTarget] = useState(500);
  const [targetUnit, setTargetUnit] = useState<'KB' | 'MB'>('KB');
  const [safetyMargin, setSafetyMargin] = useState(5);
  const [qualityFloor, setQualityFloor] = useState<QualityFloor>('balanced');
  const [resizeWidth, setResizeWidth] = useState(1200);
  const [resizeHeight, setResizeHeight] = useState(1200);
  const [resizeFormat, setResizeFormat] = useState<'jpeg' | 'png' | 'webp'>('jpeg');
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [pageStart, setPageStart] = useState(1);
  const [ocrLanguage, setOcrLanguage] = useState<OcrLanguage>('eng');

  const activeTool = useMemo(
    () => TOOLS.find((item) => item.id === activeToolId) ?? null,
    [activeToolId],
  );
  const filteredTools = useMemo(() => {
    const query = search.trim().toLowerCase();
    return TOOLS.filter((tool) => {
      const categoryMatch = category === 'all' || tool.category === category;
      const searchMatch = !query || [tool.title, tool.description, ...tool.keywords].join(' ').toLowerCase().includes(query);
      return categoryMatch && searchMatch;
    });
  }, [category, search]);
  const inputBytes = files.reduce((sum, file) => sum + file.size, 0);

  useEffect(() => {
    void refreshHistory();
    void getLocalProfile().then(setProfile).catch(() => undefined);
  }, []);

  const refreshCloud = useCallback(async () => {
    if (!profile || !supabaseConfigured) {
      setCloudState(emptyCloudState);
      return;
    }
    setCloudBusy(true);
    try {
      const next = await loadCloudState(profile.cloudDeviceId, profile.deviceId, '0.2.1');
      setCloudState(next);
      setCloudError('');
    } catch (caught) {
      setCloudError(errorMessage(caught));
    } finally {
      setCloudBusy(false);
    }
  }, [profile?.cloudDeviceId, profile?.deviceId]);

  useEffect(() => {
    if (!profile || !supabaseConfigured) return;
    void refreshCloud();
    const stopAuth = onAuthChange(() => void refreshCloud());
    return stopAuth;
  }, [profile, refreshCloud]);

  useEffect(() => {
    const userId = cloudState.user?.id;
    if (!userId) return;
    return subscribeControlPlane(userId, () => void refreshCloud());
  }, [cloudState.user?.id, refreshCloud]);

  function openTool(id: ToolId) {
    setActiveToolId(id);
    setView('tools');
    setFiles([]);
    setResult(null);
    setError('');
    setProgress({ message: '', percent: 0 });
    if (window.innerWidth < 900) setSidebarOpen(false);
  }

  function returnToLibrary() {
    setActiveToolId(null);
    setFiles([]);
    setResult(null);
    setError('');
  }

  async function acceptFiles(list: FileList | File[]) {
    if (!activeTool) return;
    const selected = Array.from(list);
    const valid = selected.filter((file) => supportsFile(activeTool, file));
    if (!valid.length) {
      setError(`Unsupported file. ${acceptedLabel(activeTool)} required.`);
      return;
    }
    setFiles((current) => appendSelectedFiles(current, valid, activeTool.multiple));
    setResult(null);
    setError(valid.length < selected.length ? 'Some unsupported files were ignored.' : '');
    if (activeTool.id === 'reorder-pages' && valid[0]) {
      try {
        const count = await pdfPageCount(valid[0]);
        setPageOrder(`1-${count}`);
      } catch { /* processing will surface a precise error */ }
    }
  }

  function moveFile(index: number, direction: -1 | 1) {
    setFiles((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setResult(null);
  }

  async function processFiles() {
    if (!activeTool || !files.length) {
      setError('Choose a file before processing.');
      return;
    }
    if (activeTool.id === 'merge' && files.length < 2) {
      setError('Merge requires at least two PDFs. Use “Add more PDFs” to append the next file.');
      return;
    }
    const started = performance.now();
    setBusy(true);
    setError('');
    setResult(null);
    setProgress({ message: 'Preparing local processing…', percent: 4 });
    let settings: HistoryEntry['settings'] = {};
    try {
      let output: ProcessingResult;
      const compressionOptions: CompressionOptions = {
        targetBytes: Math.round(target * (targetUnit === 'MB' ? 1024 * 1024 : 1024)),
        safetyMarginPercent: safetyMargin,
        qualityFloor,
      };
      const updateProgress = (message: string, percent: number) => setProgress({ message, percent });
      const count = activeTool.category === 'organize' && activeTool.id !== 'merge' ? await pdfPageCount(files[0]) : 0;

      switch (activeTool.id) {
        case 'merge': output = await mergePdfs(files); settings = { fileCount: files.length, order: files.map((file) => file.name).join(' → ') }; break;
        case 'split': output = await splitPdf(files[0]); break;
        case 'rotate': output = await rotatePdf(files[0], rotation); settings = { rotation }; break;
        case 'extract': output = await extractPdfPages(files[0], parsePageSelection(pages, count)); settings = { pages }; break;
        case 'delete-pages': output = await deletePdfPages(files[0], parsePageSelection(pages, count)); settings = { pages }; break;
        case 'reorder-pages': output = await reorderPdfPages(files[0], parseOrderedPageSelection(pageOrder, count)); settings = { pageOrder }; break;
        case 'duplicate-pages': output = await duplicatePdfPages(files[0], parsePageSelection(pages, count)); settings = { pages }; break;
        case 'add-blank-page': output = await addBlankPages(files[0], blankCount, blankSize); settings = { blankCount, blankSize }; break;
        case 'images-to-pdf': output = await imagesToPdf(files); settings = { imageCount: files.length }; break;
        case 'pdf-to-images': output = await pdfToImages(files[0]); break;
        case 'pdf-to-text': output = await pdfToText(files[0]); break;
        case 'compress-pdf': output = await compressPdf(files[0], compressionOptions, updateProgress); settings = compressionSettings(compressionOptions, targetUnit); break;
        case 'compress-image': output = await compressImage(files[0], compressionOptions, updateProgress); settings = compressionSettings(compressionOptions, targetUnit); break;
        case 'resize-image': output = await resizeImage(files[0], resizeWidth, resizeHeight, resizeFormat); settings = { resizeWidth, resizeHeight, resizeFormat }; break;
        case 'watermark': output = await addWatermark(files[0], watermarkText); settings = { watermarkText }; break;
        case 'page-numbers': output = await addPageNumbers(files[0], pageStart); settings = { pageStart }; break;
        case 'clean-metadata': output = await cleanPdfMetadata(files[0]); break;
        case 'inspect-pdf': output = await inspectPdf(files[0]); break;
        case 'ocr': output = await runOcr(files[0], ocrLanguage, updateProgress); settings = { ocrLanguage }; break;
        case 'signature-inspect': output = await inspectPdfSignatures(files[0]); break;
      }

      setProgress({ message: output.verification.passed ? 'Processing and verification passed' : 'Output created with verification warning', percent: 100 });
      setResult(output);
      const historyEntry: HistoryEntry = {
        id: crypto.randomUUID(), tool: activeTool.id, toolName: activeTool.title,
        timestamp: new Date().toISOString(), inputBytes: output.inputBytes, outputBytes: output.outputBytes,
        durationMs: Math.round(performance.now() - started), passed: output.verification.passed, settings,
      };
      await saveHistory(historyEntry);
      if (profile?.syncHistory && cloudState.profile?.status === 'approved') {
        void syncHistoryEntry(cloudState.profile.id, cloudState.device?.id ?? null, historyEntry)
          .catch((syncError) => setCloudError(`History stayed local; cloud sync failed: ${errorMessage(syncError)}`));
      }
      await refreshHistory();
    } catch (caught) {
      setError(errorMessage(caught));
      setProgress({ message: 'Processing stopped safely; the source was not changed.', percent: 0 });

      if (cloudState.profile?.status === 'approved' && activeTool && shouldReportProcessingError(caught)) {
        const diagnostic = classifyProcessingError({
          tool: activeTool.id,
          error: caught,
          files,
        });
        void submitDiagnostic({
          fingerprint: diagnostic.fingerprint,
          accountId: cloudState.profile.id,
          deviceId: cloudState.device?.id ?? null,
          appVersion: '0.2.1',
          module: activeTool.id,
          errorCode: diagnostic.code,
          safeMessage: diagnostic.message,
          safeContext: diagnostic.context,
        }).catch((diagnosticError) => {
          setCloudError(`Diagnostic stayed local; report upload failed: ${errorMessage(diagnosticError)}`);
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function refreshHistory() {
    try { setHistory(await getHistory()); } catch { setHistory([]); }
  }

  async function removeHistory() {
    await clearHistory();
    await refreshHistory();
  }

  async function persistProfile() {
    if (!profile) return;
    await saveLocalProfile(profile);
    if (cloudState.user) {
      try { await updateDisplayName(profile.name); } catch (caught) { setCloudError(errorMessage(caught)); }
    }
    setProfile(await getLocalProfile());
    setProfileSaved(true);
    window.setTimeout(() => setProfileSaved(false), 1800);
  }

  async function handleCloudSignIn(email: string, password: string) {
    setCloudBusy(true); setCloudError('');
    try { await signIn(email, password); await refreshCloud(); }
    catch (caught) { setCloudError(errorMessage(caught)); }
    finally { setCloudBusy(false); }
  }

  async function handleCloudSignUp(email: string, password: string) {
    if (!profile) return;
    setCloudBusy(true); setCloudError('');
    try { await signUp(email, password, profile.name); await refreshCloud(); }
    catch (caught) { setCloudError(errorMessage(caught)); }
    finally { setCloudBusy(false); }
  }

  async function handleCloudSignOut() {
    setCloudBusy(true); setCloudError('');
    try { await signOut(); setCloudState({ ...emptyCloudState, connected: supabaseConfigured }); }
    catch (caught) { setCloudError(errorMessage(caught)); }
    finally { setCloudBusy(false); }
  }

  return (
    <div className={`app-shell ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><FileOutput size={21} /></div>
          <div><strong>Document Toolkit</strong><span>Private workstation</span></div>
          <button className="icon-button sidebar-toggle" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><PanelLeftClose size={18} /></button>
        </div>
        <nav className="category-nav" aria-label="Tool categories">
          <button className={view === 'tools' && category === 'all' ? 'active' : ''} onClick={() => { setView('tools'); setCategory('all'); returnToLibrary(); }}><LayoutGrid size={18} /><span>All tools</span><b>{TOOLS.length}</b></button>
          {(Object.keys(CATEGORY_LABELS) as ToolCategory[]).map((key) => (
            <button key={key} className={view === 'tools' && category === key ? 'active' : ''} onClick={() => { setView('tools'); setCategory(key); returnToLibrary(); }}>
              <CategoryIcon category={key} /><span>{CATEGORY_LABELS[key]}</span><b>{TOOLS.filter((tool) => tool.category === key).length}</b>
            </button>
          ))}
          <div className="nav-divider" />
          <button className={view === 'history' ? 'active' : ''} onClick={() => { setView('history'); setActiveToolId(null); }}><History size={18} /><span>History</span><b>{history.length}</b></button>
          <button onClick={() => setProfileOpen(true)}><UserRound size={18} /><span>Account & device</span><ChevronRight size={15} /></button>
        </nav>
        <div className="privacy-card"><ShieldCheck size={19} /><div><strong>Local by default</strong><span>Documents remain on this device.</span></div></div>
        <div className="version">Milestone 2 · v0.2.1</div>
      </aside>

      <main>
        <header className="topbar">
          <div className="topbar-left">
            {!sidebarOpen && <button className="icon-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>}
            <button className="wordmark" onClick={() => { setView('tools'); returnToLibrary(); }}>Workspace</button>
            <span className="top-separator" />
            <div className="local-pill"><LockKeyhole size={13} /> On-device</div>
          </div>
          <div className="top-actions">
            <button className="top-action" onClick={() => { setView('history'); setActiveToolId(null); }}><History size={17} /><span>History</span></button>
            <button className="profile-button" onClick={() => setProfileOpen(true)} aria-label="Open account profile">
              <span>{initials(profile?.name || 'Local User')}</span><div><strong>{profile?.name || 'Local User'}</strong><small>Personal mode</small></div><ChevronRight size={15} />
            </button>
          </div>
        </header>

        <div className="content">
          {view === 'history' ? (
            <HistoryPanel entries={history} onClear={() => void removeHistory()} />
          ) : activeTool ? (
            <ToolWorkspace
              tool={activeTool} files={files} inputBytes={inputBytes} busy={busy} error={error}
              progress={progress} result={result} dragging={dragging} inputRef={inputRef}
              setDragging={setDragging} acceptFiles={acceptFiles} setFiles={setFiles} setResult={setResult}
              moveFile={moveFile} processFiles={processFiles} returnToLibrary={returnToLibrary}
              settings={{ rotation, pages, pageOrder, blankCount, blankSize, target, targetUnit, safetyMargin, qualityFloor, resizeWidth, resizeHeight, resizeFormat, watermarkText, pageStart, ocrLanguage }}
              setters={{ setRotation, setPages, setPageOrder, setBlankCount, setBlankSize, setTarget, setTargetUnit, setSafetyMargin, setQualityFloor, setResizeWidth, setResizeHeight, setResizeFormat, setWatermarkText, setPageStart, setOcrLanguage }}
            />
          ) : (
            <ToolLibrary tools={filteredTools} category={category} search={search} setSearch={setSearch} openTool={openTool} />
          )}
        </div>
      </main>

      {profileOpen && profile && <ProfileDrawer profile={profile} setProfile={setProfile} cloudState={cloudState} cloudBusy={cloudBusy} cloudError={cloudError} onCloudSignIn={handleCloudSignIn} onCloudSignUp={handleCloudSignUp} onCloudSignOut={handleCloudSignOut} onClose={() => setProfileOpen(false)} onSave={() => void persistProfile()} saved={profileSaved} />}
    </div>
  );
}

interface WorkspaceProps {
  tool: ToolDefinition; files: File[]; inputBytes: number; busy: boolean; error: string;
  progress: { message: string; percent: number }; result: ProcessingResult | null; dragging: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>; setDragging: (value: boolean) => void;
  acceptFiles: (files: FileList | File[]) => Promise<void>; setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  setResult: (value: ProcessingResult | null) => void; moveFile: (index: number, direction: -1 | 1) => void;
  processFiles: () => Promise<void>; returnToLibrary: () => void;
  settings: SettingsState; setters: SettingsSetters;
}

interface SettingsState {
  rotation: number; pages: string; pageOrder: string; blankCount: number; blankSize: 'a4' | 'letter' | 'match';
  target: number; targetUnit: 'KB' | 'MB'; safetyMargin: number; qualityFloor: QualityFloor;
  resizeWidth: number; resizeHeight: number; resizeFormat: 'jpeg' | 'png' | 'webp';
  watermarkText: string; pageStart: number; ocrLanguage: OcrLanguage;
}

interface SettingsSetters {
  setRotation: (value: number) => void; setPages: (value: string) => void; setPageOrder: (value: string) => void;
  setBlankCount: (value: number) => void; setBlankSize: (value: 'a4' | 'letter' | 'match') => void;
  setTarget: (value: number) => void; setTargetUnit: (value: 'KB' | 'MB') => void;
  setSafetyMargin: (value: number) => void; setQualityFloor: (value: QualityFloor) => void;
  setResizeWidth: (value: number) => void; setResizeHeight: (value: number) => void;
  setResizeFormat: (value: 'jpeg' | 'png' | 'webp') => void; setWatermarkText: (value: string) => void;
  setPageStart: (value: number) => void; setOcrLanguage: (value: OcrLanguage) => void;
}

function ToolLibrary({ tools, category, search, setSearch, openTool }: { tools: ToolDefinition[]; category: CategoryFilter; search: string; setSearch: (value: string) => void; openTool: (id: ToolId) => void }) {
  return (
    <section className="library-view">
      <div className="library-header"><div><span className="eyebrow">20 working document operations</span><h1>{category === 'all' ? 'What do you need to do?' : CATEGORY_LABELS[category]}</h1><p>Choose a tool. Only implemented operations appear here; future capabilities stay out until they work.</p></div></div>
      <label className="tool-search"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tools — merge, OCR, signatures, resize…" /><kbd>20 tools</kbd></label>
      {tools.length ? <div className="tool-grid">{tools.map((tool) => { const Icon = TOOL_ICONS[tool.id]; return <button className="tool-card" key={tool.id} onClick={() => openTool(tool.id)}><div className={`tool-card-icon cat-${tool.category}`}><Icon size={20} /></div><div><span>{CATEGORY_LABELS[tool.category]}</span><h2>{tool.title}</h2><p>{tool.description}</p></div><ChevronRight className="tool-arrow" size={18} /></button>; })}</div> : <div className="no-tools"><ScanSearch size={30} /><h2>No matching tool</h2><p>Try a broader word or choose another category.</p></div>}
    </section>
  );
}

function ToolWorkspace(props: WorkspaceProps) {
  const { tool, files, inputBytes, busy, error, progress, result, dragging, inputRef, setDragging, acceptFiles, setFiles, setResult, moveFile, processFiles, returnToLibrary, settings, setters } = props;
  const Icon = TOOL_ICONS[tool.id];
  return (
    <section className="tool-workspace">
      <button className="back-button" onClick={returnToLibrary}><ArrowLeft size={16} /> All tools</button>
      <div className="tool-title-row"><div className={`hero-icon cat-${tool.category}`}><Icon size={25} /></div><div><span className="eyebrow">{CATEGORY_LABELS[tool.category]}</span><h1>{tool.title}</h1><p>{tool.description}. Files are processed locally and originals remain untouched.</p></div></div>
      {tool.id === 'merge' && <div className="rule-banner"><Combine size={19} /><div><strong>Merge rule</strong><span>Select at least two PDFs. Every later selection is appended; use the arrows below to set the exact merge order.</span></div></div>}
      {tool.id === 'signature-inspect' && <div className="rule-banner caution"><Fingerprint size={19} /><div><strong>Basic integrity inspection</strong><span>Checks embedded signature markers, ByteRange structure, hashes, and unsigned trailing bytes. It does not yet claim certificate-chain trust.</span></div></div>}
      <div className="workspace-grid">
        <div className="work-column">
          <section className={`drop-zone ${dragging ? 'dragging' : ''} ${files.length ? 'compact' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void acceptFiles(event.dataTransfer.files); }}>
            <input ref={inputRef} type="file" accept={tool.accepts} multiple={tool.multiple} aria-label={`Select files for ${tool.title}`} onChange={(event) => { if (event.currentTarget.files) void acceptFiles(event.currentTarget.files); event.currentTarget.value = ''; }} />
            <div className="upload-illustration"><Plus size={27} /></div><div><h2>{files.length && tool.multiple ? `Add more ${acceptedLabel(tool)}` : `Choose ${tool.multiple ? 'files' : 'a file'}`}</h2><p>{acceptedLabel(tool)} · drag and drop or browse</p></div><button className="secondary-button" onClick={() => inputRef.current?.click()}>{files.length && tool.multiple ? 'Add more' : 'Browse files'}</button>
          </section>
          {files.length > 0 && <section className="selected-files"><div className="section-heading"><div><span className="eyebrow">Input {tool.id === 'merge' ? 'and output order' : ''}</span><h2>{files.length} file{files.length === 1 ? '' : 's'} · {humanBytes(inputBytes)}</h2></div><button className="text-button danger" onClick={() => { setFiles([]); setResult(null); }}><Trash2 size={15} /> Clear</button></div><div className="file-list">{files.map((file, index) => <div className="file-row" key={`${file.name}-${file.lastModified}-${index}`}><span className="order-index">{index + 1}</span><div className="file-icon">{file.type.startsWith('image/') ? <FileImage size={17} /> : <Files size={17} />}</div><div><strong>{file.name}</strong><span>{humanBytes(file.size)}</span></div>{tool.multiple && <div className="file-order"><button className="icon-button" disabled={index === 0} onClick={() => moveFile(index, -1)} aria-label={`Move ${file.name} up`}><ArrowUp size={15} /></button><button className="icon-button" disabled={index === files.length - 1} onClick={() => moveFile(index, 1)} aria-label={`Move ${file.name} down`}><ArrowDown size={15} /></button></div>}<button className="icon-button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={16} /></button></div>)}</div></section>}
          {files.length > 1 && <FilePreviewGallery files={files} />}
          {files.length === 1 && !isPdf(files[0]) && <FilePreviewGallery files={files} />}
          {files.length === 1 && isPdf(files[0]) && ['extract', 'delete-pages', 'duplicate-pages'].includes(tool.id) && <PdfPageGrid file={files[0]} mode="select" selection={settings.pages} onSelectionChange={setters.setPages} selectionLabel={tool.id === 'delete-pages' ? 'selected for deletion' : tool.id === 'extract' ? 'selected for extraction' : 'selected for duplication'} />}
          {files.length === 1 && isPdf(files[0]) && tool.id === 'reorder-pages' && <PdfPageGrid file={files[0]} mode="preview" />}
          {files.length === 1 && isPdf(files[0]) && !['extract', 'delete-pages', 'duplicate-pages', 'reorder-pages'].includes(tool.id) && <PdfViewer file={files[0]} />}
        </div>
        <aside className="settings-panel"><div className="section-heading compact"><div><span className="eyebrow">Output</span><h2>Settings & verification</h2></div><Settings size={18} /></div><div className="settings-body"><ToolSettings tool={tool} state={settings} setters={setters} />{error && <div className="error-box"><CircleAlert size={18} /><span>{error}</span></div>}<button className="primary-button" onClick={() => void processFiles()} disabled={busy || !files.length}>{busy ? <LoaderCircle className="spin" size={18} /> : <Icon size={18} />}{busy ? 'Processing locally…' : `Create ${tool.output}`}</button>{(busy || progress.message) && <div className="progress-block"><div><span>{progress.message}</span><strong>{Math.round(progress.percent)}%</strong></div><div className="progress-track"><span style={{ width: `${progress.percent}%` }} /></div></div>}</div>{result && <ResultPanel result={result} />}</aside>
      </div>
    </section>
  );
}

function ToolSettings({ tool, state, setters }: { tool: ToolDefinition; state: SettingsState; setters: SettingsSetters }) {
  if (tool.id === 'rotate') return <Field label="Clockwise rotation"><div className="segmented">{[90, 180, 270].map((value) => <button key={value} className={state.rotation === value ? 'active' : ''} onClick={() => setters.setRotation(value)}>{value}°</button>)}</div></Field>;
  if (['extract', 'delete-pages', 'duplicate-pages'].includes(tool.id)) return <Field label={tool.id === 'extract' ? 'Pages to extract' : tool.id === 'delete-pages' ? 'Pages to delete' : 'Pages to duplicate'} hint="Example: 1, 3-5, 9"><input className="control" value={state.pages} onChange={(event) => setters.setPages(event.target.value)} /></Field>;
  if (tool.id === 'reorder-pages') return <Field label="Complete new page order" hint="Every page exactly once. Example: 3, 1, 2, 5-4"><input className="control" value={state.pageOrder} onChange={(event) => setters.setPageOrder(event.target.value)} /></Field>;
  if (tool.id === 'add-blank-page') return <><Field label="Number of blank pages"><input className="control" type="number" min="1" max="50" value={state.blankCount} onChange={(event) => setters.setBlankCount(Number(event.target.value))} /></Field><Field label="Blank page size"><select className="control" value={state.blankSize} onChange={(event) => setters.setBlankSize(event.target.value as SettingsState['blankSize'])}><option value="match">Match last page</option><option value="a4">A4</option><option value="letter">US Letter</option></select></Field></>;
  if (tool.id === 'compress-pdf' || tool.id === 'compress-image') return <><Field label="Maximum output size" hint={`Internal target includes ${state.safetyMargin}% safety margin`}><div className="input-group"><input className="control" type="number" min="10" value={state.target} onChange={(event) => setters.setTarget(Number(event.target.value))} /><select className="control unit" value={state.targetUnit} onChange={(event) => setters.setTargetUnit(event.target.value as 'KB' | 'MB')}><option>KB</option><option>MB</option></select></div></Field><Field label="Quality floor"><select className="control" value={state.qualityFloor} onChange={(event) => setters.setQualityFloor(event.target.value as QualityFloor)}><option value="high">High</option><option value="balanced">Balanced</option><option value="aggressive">Aggressive</option></select></Field><Field label={`Safety margin · ${state.safetyMargin}%`}><input className="range" type="range" min="0" max="15" value={state.safetyMargin} onChange={(event) => setters.setSafetyMargin(Number(event.target.value))} /></Field><div className="target-summary"><span>Requested maximum</span><strong>{state.target} {state.targetUnit}</strong><span>Internal target</span><strong>{Math.round(state.target * (1 - state.safetyMargin / 100) * 100) / 100} {state.targetUnit}</strong></div></>;
  if (tool.id === 'resize-image') return <><div className="two-fields"><Field label="Width (px)"><input className="control" type="number" min="1" max="12000" value={state.resizeWidth} onChange={(event) => setters.setResizeWidth(Number(event.target.value))} /></Field><Field label="Height (px)"><input className="control" type="number" min="1" max="12000" value={state.resizeHeight} onChange={(event) => setters.setResizeHeight(Number(event.target.value))} /></Field></div><Field label="Output format"><select className="control" value={state.resizeFormat} onChange={(event) => setters.setResizeFormat(event.target.value as SettingsState['resizeFormat'])}><option value="jpeg">JPEG</option><option value="png">PNG</option><option value="webp">WebP</option></select></Field></>;
  if (tool.id === 'watermark') return <Field label="Watermark text" hint="Applied diagonally to every page"><input className="control" maxLength={120} value={state.watermarkText} onChange={(event) => setters.setWatermarkText(event.target.value)} /></Field>;
  if (tool.id === 'page-numbers') return <Field label="Start numbering at"><input className="control" type="number" min="0" value={state.pageStart} onChange={(event) => setters.setPageStart(Number(event.target.value))} /></Field>;
  if (tool.id === 'ocr') return <><Field label="Document language"><select className="control" value={state.ocrLanguage} onChange={(event) => setters.setOcrLanguage(event.target.value as OcrLanguage)}><option value="eng">English</option><option value="hin">Hindi</option><option value="asm">Assamese</option></select></Field><div className="automatic-card"><Languages size={20} /><div><strong>Bundled offline model</strong><span>No document image is sent to an OCR server. Review confidence and spelling before official use.</span></div></div></>;
  return <div className="automatic-card"><RefreshCw size={20} /><div><strong>Safe automatic mode</strong><span>The output structure and expected result are checked after processing.</span></div></div>;
}

function ProfileDrawer({
  profile, setProfile, cloudState, cloudBusy, cloudError, onCloudSignIn, onCloudSignUp, onCloudSignOut,
  onClose, onSave, saved,
}: {
  profile: LocalProfile; setProfile: (profile: LocalProfile) => void; cloudState: CloudState; cloudBusy: boolean; cloudError: string;
  onCloudSignIn: (email: string, password: string) => Promise<void>; onCloudSignUp: (email: string, password: string) => Promise<void>;
  onCloudSignOut: () => Promise<void>; onClose: () => void; onSave: () => void; saved: boolean;
}) {
  const [authEmail, setAuthEmail] = useState(profile.email);
  const [authPassword, setAuthPassword] = useState('');
  const approved = cloudState.profile?.status === 'approved';
  const cloudLabel = cloudState.profile ? `${cloudState.profile.role} · ${cloudState.profile.status}` : 'Not signed in';
  return <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="profile-drawer">
      <div className="drawer-header"><div><span className="eyebrow">Account & device</span><h2>Personal workspace</h2></div><button className="icon-button" onClick={onClose} aria-label="Close account profile"><X size={19} /></button></div>
      <div className="profile-identity"><div className="large-avatar">{initials(profile.name)}</div><div><strong>{profile.name || 'Local User'}</strong><span>{cloudState.user ? cloudLabel : 'Owner · Local personal mode'}</span></div></div>
      <div className="drawer-body">
        <div className="settings-section"><h3>Profile</h3><Field label="Display name"><input className="control" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></Field><Field label="Email"><input className="control" type="email" value={profile.email} onChange={(event) => { setProfile({ ...profile, email: event.target.value }); setAuthEmail(event.target.value); }} /></Field></div>
        {!cloudState.user && supabaseConfigured && <div className="settings-section"><h3>Cloud account</h3><Field label="Email"><input className="control" type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} /></Field><Field label="Password"><input className="control" type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} minLength={8} /></Field><div className="cloud-auth-actions"><button className="primary-button" disabled={cloudBusy || !authEmail || authPassword.length < 8} onClick={() => void onCloudSignIn(authEmail, authPassword)}>{cloudBusy ? <LoaderCircle className="spin" size={17} /> : <LockKeyhole size={17} />} Sign in</button><button className="secondary-button" disabled={cloudBusy || !authEmail || authPassword.length < 8} onClick={() => void onCloudSignUp(authEmail, authPassword)}>Create account</button></div><p className="setting-note">New accounts start pending. An admin must approve the account before cloud metadata sync or device registration is allowed.</p></div>}
        <div className="settings-section"><h3>Identity</h3><IdentityRow label="Local account ID" value={profile.accountId} /><IdentityRow label="Local device ID" value={profile.deviceId} />{cloudState.user && <IdentityRow label="Supabase user" value={cloudState.user.id} />}{cloudState.device && <IdentityRow label="Cloud device" value={cloudState.device.public_device_id} />}<Field label="Update channel"><select className="control" value={profile.releaseChannel} onChange={(event) => setProfile({ ...profile, releaseChannel: event.target.value as LocalProfile['releaseChannel'] })}><option value="stable">Stable</option><option value="beta">Beta</option><option value="developer">Developer</option></select></Field></div>
        <div className="settings-section"><h3>Privacy</h3><Toggle label="Sync operation history" checked={profile.syncHistory} onChange={(checked) => setProfile({ ...profile, syncHistory: checked })} disabled={!approved} /><Toggle label="Sync diagnostics" checked={profile.syncDiagnostics} onChange={(checked) => setProfile({ ...profile, syncDiagnostics: checked })} disabled={!approved} /><p className="setting-note">Only safe metadata is eligible for sync. Document bytes, extracted text, local file paths, and PDF contents stay on this device.</p></div>
        {!supabaseConfigured ? <div className="backend-status"><CircleAlert size={18} /><div><strong>Supabase configuration missing</strong><span>Local document tools remain available.</span></div></div> : <div className={`backend-status ${cloudState.connected ? 'connected' : ''}`}>{cloudState.connected ? <CheckCircle2 size={18} /> : <LoaderCircle size={18} />}<div><strong>{cloudState.user ? `Supabase connected · ${cloudState.profile?.status ?? 'loading'}` : 'Supabase connected · sign-in required'}</strong><span>{cloudState.profile?.status === 'pending' ? 'Account is waiting for administrator approval.' : cloudState.profile?.status === 'rejected' ? (cloudState.profile.rejection_reason || 'Account request was rejected.') : cloudState.profile?.status === 'disabled' ? 'Account is disabled.' : approved ? `Device trust: ${cloudState.device?.trust ?? 'registering'}.` : 'Authentication is available; local tools remain independent.'}</span></div></div>}
        {cloudError && <div className="error-banner"><CircleAlert size={17} /><span>{cloudError}</span></div>}
      </div>
      <div className="drawer-footer">{cloudState.user && <button className="secondary-button" disabled={cloudBusy} onClick={() => void onCloudSignOut()}>Sign out</button>}<button className="primary-button" onClick={onSave}>{saved ? <Check size={18} /> : <UserRound size={18} />}{saved ? 'Profile saved' : 'Save profile'}</button></div>
    </aside>
  </div>;
}

function HistoryPanel({ entries, onClear }: { entries: HistoryEntry[]; onClear: () => void }) {
  return <div className="history-panel">
    <div className="section-heading"><div><span className="eyebrow">Operation history</span><h2>{entries.length} operation{entries.length === 1 ? '' : 's'}</h2></div>{entries.length > 0 && <button className="text-button danger" onClick={onClear}><Trash2 size={15} /> Clear</button>}</div>
    {entries.length === 0 ? (
      <div className="empty-state"><History size={32} /><h3>No operations yet</h3><p>Tools you run will appear here.</p></div>
    ) : (
      <div className="history-list">{entries.map((entry) => (
        <div className="history-item" key={entry.id}>
          <div className="history-icon" style={{ opacity: entry.passed ? 1 : 0.6 }}>{entry.passed ? <CheckCircle2 size={18} /> : <CircleAlert size={18} />}</div>
          <div className="history-content">
            <div><strong>{entry.toolName}</strong><span className="history-time">{new Date(entry.timestamp).toLocaleDateString()} {new Date(entry.timestamp).toLocaleTimeString()}</span></div>
            <div className="history-meta">
              {entry.inputBytes > 0 && <span>{humanBytes(entry.inputBytes)} → {humanBytes(entry.outputBytes)}</span>}
              {entry.durationMs > 0 && <span>{(entry.durationMs / 1000).toFixed(1)}s</span>}
              {!entry.passed && <span className="warning">Verification issues</span>}
            </div>
          </div>
        </div>
      ))}</div>
    )}
  </div>;
}

function ResultPanel({ result }: { result: ProcessingResult }) {
  return <div className="result-panel">
    <div className="section-heading"><div><span className="eyebrow">{result.verification.passed ? 'Verified output' : 'Output needs attention'}</span><h2>Download file</h2></div></div>
    <div className="result-content">
      <div className="result-summary">
        <div><span>Input</span><strong>{humanBytes(result.inputBytes)}</strong></div>
        <div><span>Output</span><strong>{humanBytes(result.outputBytes)}</strong></div>
        <div><span>Reduction</span><strong>{result.inputBytes > 0 ? ((1 - result.outputBytes / result.inputBytes) * 100).toFixed(0) : 0}%</strong></div>
      </div>
      {result.note && <div className="result-note"><Info size={16} /><span>{result.note}</span></div>}
      <div className="result-verification">
        {result.verification.checks.map((check) => (
          <div className="verification-check" key={check.label}>
            <div className="check-status">{check.passed ? <Check size={16} className="pass" /> : <CircleAlert size={16} className="fail" />}</div>
            <div><div className="check-label">{check.label}</div><div className="check-detail">{check.detail}</div></div>
          </div>
        ))}
      </div>
      <button className="primary-button" onClick={() => downloadBlob(result.blob, result.fileName)}><Download size={17} /> Download {result.fileName}</button>
    </div>
  </div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
function IdentityRow({ label, value }: { label: string; value: string }) { return <div className="identity-row"><span>{label}</span><code>{value}</code></div>; }
function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) { return <label className={`toggle-row ${disabled ? 'disabled' : ''}`}><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} /><i /></label>; }
function CategoryIcon({ category }: { category: ToolCategory }) { const Icon = category === 'organize' ? Boxes : category === 'convert' ? RefreshCw : category === 'optimize' ? Gauge : category === 'edit' ? Wand2 : ShieldCheck; return <Icon size={18} />; }
function isPdf(file: File) { return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'); }
function supportsFile(tool: ToolDefinition, file: File) { if (tool.id === 'ocr') return isPdf(file) || file.type.startsWith('image/'); return tool.accepts.includes('image/*') ? file.type.startsWith('image/') : isPdf(file); }
function acceptedLabel(tool: ToolDefinition) { if (tool.id === 'ocr') return 'PDF or image'; return tool.accepts.includes('image/*') ? 'image files' : 'PDF files'; }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'U'; }
function compressionSettings(options: CompressionOptions, unit: string): HistoryEntry['settings'] { return { target: options.targetBytes, unit, safetyMargin: options.safetyMarginPercent, qualityFloor: options.qualityFloor }; }
