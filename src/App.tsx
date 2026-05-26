import { useState, useEffect, useCallback } from 'react'
import './index.css'
import type { VaultNode, Project } from './types'
import { BOOT_LINES, BOOT_LINE_DELAY, BOOT_CHAR_DELAY, BOOT_FINISH_DELAY } from './types'
import { applyFontSize, countVaultFiles } from './helpers'
import { Scanline } from './Shared'
import BootScreen from './BootScreen'
import Sidebar from './Sidebar'
import MiddlePanel from './MiddlePanel'
import SystemPanel from './SystemPanel'
import DetailPanel, { NewProjectForm } from './ProjectPanel'
import StatusBar from './StatusBar'
import VaultPanel from './VaultPanel'
import NodePanel, { type QuickLaunchApp } from './NodePanel'
import MessagesPanel from './MessagesPanel'
import MailPanel from './MailPanel'
import projectsData from './assets/projects.json'

const PROJECTS_FALLBACK = projectsData as Project[]

export default function App() {
  const [booted, setBooted]               = useState(false)
  const [bootLines, setBootLines]         = useState<string[]>([])
  const [activeSection, setSection]       = useState('node')
  const [selectedItem, setSelected]       = useState<string | null>(null)
  const [systemCategory, setSystemCategory] = useState('display')
  const [time, setTime]                   = useState('')
  const [vaultFileCount, setVaultFileCount] = useState(0)
  const [vaultTree, setVaultTree]         = useState<VaultNode[]>([])
  const [vaultLoading, setVaultLoading]   = useState(false)
  const [vaultError, setVaultError]       = useState(false)
  const [selectedGame, setSelectedGame]   = useState<string | null>(null)
  const [selectedFile, setSelectedFile]   = useState<string | null>(null)
  const [projects, setProjects]           = useState<Project[]>([])
  const [addingProject, setAddingProject] = useState(false)
  const [quickLaunchApps, setQuickLaunchApps] = useState<QuickLaunchApp[] | undefined>(undefined)

  const loadVault = useCallback(async () => {
    const api = window.electronAPI?.vaultAPI
    if (!api) return
    setVaultLoading(true)
    setVaultError(false)
    try {
      const tree = await api.readTree()
      setVaultTree(tree)
      setVaultFileCount(countVaultFiles(tree))
    } catch {
      setVaultError(true)
    } finally {
      setVaultLoading(false)
    }
  }, [])

  const handleChooseVaultPath = useCallback(async () => {
    const api = window.electronAPI?.vaultAPI
    if (!api) return
    const result = await api.choosePath()
    if (result) loadVault()
  }, [loadVault])

  useEffect(() => {
    let lineIndex = 0
    let charIndex = 0
    let currentLine = ''
    let timeoutId: ReturnType<typeof setTimeout>

    function typeNextChar() {
      const line = BOOT_LINES[lineIndex]

      if (!line) {
        timeoutId = setTimeout(() => setBooted(true), BOOT_FINISH_DELAY)
        return
      }

      if (charIndex < line.length) {
        currentLine += line[charIndex]
        setBootLines(prev => {
          const next = [...prev]
          next[lineIndex] = currentLine
          return next
        })
        charIndex++
        timeoutId = setTimeout(typeNextChar, BOOT_CHAR_DELAY)
      } else {
        lineIndex++
        charIndex = 0
        currentLine = ''
        timeoutId = setTimeout(typeNextChar, BOOT_LINE_DELAY)
      }
    }

    typeNextChar()
    return () => clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour12: false }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    async function applyStoredBrightness() {
      const val = await window.electronAPI?.settingsAPI?.get('brightness')
      const brightness = typeof val === 'number' ? val : 85
      const root = document.getElementById('root')
      if (root) root.style.filter = `brightness(${brightness / 100})`
    }
    void applyStoredBrightness()
  }, [])

  useEffect(() => {
    const TEXT_MODES = {
      dim:    { '--text': '#7ab3d4', '--dim': '#3d7a99', '--dimmer': '#1f4d66' },
      mid:    { '--text': '#a8d4ee', '--dim': '#6aadcc', '--dimmer': '#3d7a99' },
      bright: { '--text': '#d4eeff', '--dim': '#99d4ee', '--dimmer': '#6aadcc' },
    } as const
    async function applyStoredTextMode() {
      const m = await window.electronAPI?.settingsAPI?.get('textMode')
      const mode = (m === 'dim' || m === 'mid' || m === 'bright') ? m : 'mid'
      const vars = TEXT_MODES[mode]
      document.documentElement.style.setProperty('--text',   vars['--text'])
      document.documentElement.style.setProperty('--dim',    vars['--dim'])
      document.documentElement.style.setProperty('--dimmer', vars['--dimmer'])
    }
    void applyStoredTextMode()
  }, [])

  useEffect(() => {
    async function applyStoredFontSize() {
      const f = await window.electronAPI?.settingsAPI?.get('fontSize')
      if (f === 'S' || f === 'M' || f === 'L') applyFontSize(f)
    }
    void applyStoredFontSize()
  }, [])

  useEffect(() => {
    if (!booted) return
    loadVault()
    const api = window.electronAPI?.vaultAPI
    if (!api) return
    api.onChange(loadVault)
    return () => api.offChange(loadVault)
  }, [booted, loadVault])

  useEffect(() => {
    if (!booted) return
    async function loadProjects() {
      const stored = await window.electronAPI?.settingsAPI?.get('projects')
      if (Array.isArray(stored) && stored.length > 0) {
        setProjects(stored as Project[])
      } else {
        setProjects(PROJECTS_FALLBACK)
        void window.electronAPI?.settingsAPI?.set('projects', PROJECTS_FALLBACK)
      }
    }
    void loadProjects()
  }, [booted])

  useEffect(() => {
    if (!booted) return
    async function loadQuickLaunch() {
      const stored = await window.electronAPI?.settingsAPI?.get('quickLaunch')
      if (Array.isArray(stored) && stored.length > 0) setQuickLaunchApps(stored as QuickLaunchApp[])
    }
    void loadQuickLaunch()
  }, [booted])

  if (!booted) return <><Scanline /><BootScreen lines={bootLines} /></>

  return (
    <>
      <Scanline />
      <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', animation: 'flicker 8s infinite' }}>
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <Sidebar
            active={activeSection}
            onSelect={id => { setSection(id); setSelected(null); setAddingProject(false) }}
            vaultTree={vaultTree}
            vaultLoading={vaultLoading}
            vaultError={vaultError}
            selectedGame={selectedGame}
            onSelectGame={path => { setSelectedGame(path); setSelectedFile(null) }}
            onChooseVaultPath={handleChooseVaultPath}
          />
          {activeSection === 'node' ? (
            <NodePanel quickLaunchApps={quickLaunchApps} />
          ) : activeSection === 'mail' ? (
            <MailPanel />
          ) : activeSection === 'messages' ? (
            <MessagesPanel />
          ) : (
            <>
              <MiddlePanel
                section={activeSection}
                selected={activeSection === 'system' ? systemCategory : selectedItem}
                onSelect={activeSection === 'system' ? setSystemCategory : id => { setSelected(id); setAddingProject(false) }}
                vaultTree={vaultTree}
                selectedGame={selectedGame}
                selectedFile={selectedFile}
                onSelectFile={setSelectedFile}
                projects={projects}
                onAddProject={() => { setAddingProject(true); setSelected(null) }}
              />
              {activeSection === 'vault'
                ? <VaultPanel selectedFile={selectedFile} onSelectFile={setSelectedFile} />
                : activeSection === 'system'
                ? <SystemPanel category={systemCategory} onVaultSaved={loadVault} onQuickLaunchSaved={apps => setQuickLaunchApps(apps)} />
                : addingProject
                ? <NewProjectForm
                    onCreated={async project => {
                      const updated = [...projects, project]
                      setProjects(updated)
                      await window.electronAPI?.settingsAPI?.set('projects', updated)
                      setAddingProject(false)
                      setSelected(project.id)
                    }}
                    onCancel={() => setAddingProject(false)}
                  />
                : <DetailPanel
                    projectId={selectedItem}
                    projects={projects}
                    onRemove={async id => {
                      const updated = projects.filter(p => p.id !== id)
                      setProjects(updated)
                      await window.electronAPI?.settingsAPI?.set('projects', updated)
                      setSelected(null)
                    }}
                    onUpdate={async project => {
                      const updated = projects.map(p => p.id === project.id ? project : p)
                      setProjects(updated)
                      await window.electronAPI?.settingsAPI?.set('projects', updated)
                    }}
                  />
              }
            </>
          )}
        </div>
        <StatusBar time={time} vaultFileCount={vaultFileCount} />
      </div>
    </>
  )
}
