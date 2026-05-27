import { useMemo, useRef, useState } from 'react'
import 'react-cartoon-planet/style.css'
import './App.css'
import { CartoonPlanet, type CartoonPlanetController, type GlobeState, type RenderModeId } from 'react-cartoon-planet'

function App() {
  const controllerRef = useRef<CartoonPlanetController | null>(null)
  const [planetState, setPlanetState] = useState<GlobeState | null>(null)
  const initialState = useMemo(
    () => ({ map: 'earth' as const, renderMode: 'surface' as const, startView: 'globe' as const }),
    []
  )

  function setMode(mode: RenderModeId) {
    controllerRef.current?.setRenderMode(mode)
  }

  function setMap(map: 'earth' | 'moon') {
    controllerRef.current?.setPlanetMap(map)
  }

  function setView(view: 'globe' | 'ground') {
    controllerRef.current?.setStartView(view)
  }

  return (
    <main className="demo-root">
      <header className="demo-toolbar">
        <h1>react-cartoon-planet demo</h1>
        <div className="demo-actions">
          <button type="button" onClick={() => setMode('surface')}>Solid</button>
          <button type="button" onClick={() => setMode('dots')}>Dots</button>
          <button type="button" onClick={() => setMode('hybrid')}>Hybrid</button>
          <button type="button" onClick={() => setMode('cyberpunk')}>Cyber</button>
          <button type="button" onClick={() => setMap('earth')}>Earth</button>
          <button type="button" onClick={() => setMap('moon')}>Moon</button>
          <button type="button" onClick={() => setView('globe')}>Start globe</button>
          <button type="button" onClick={() => setView('ground')}>Start ground</button>
          <button type="button" onClick={() => controllerRef.current?.flyTo(-74.006, 40.7128, 1_500)}>
            Fly NYC
          </button>
        </div>
      </header>
      <section className="demo-canvas">
        <CartoonPlanet
          ref={controllerRef}
          initialState={initialState}
          onReady={(controller) => {
            controllerRef.current = controller
          }}
          onStateChange={setPlanetState}
        />
      </section>
      <section className="demo-status">
        <span>mode: {planetState?.renderMode ?? 'loading'}</span>
        <span>map: {planetState?.planetMap ?? 'loading'}</span>
        <span>fps: {planetState?.fps ?? 0}</span>
      </section>
    </main>
  )
}

export default App
