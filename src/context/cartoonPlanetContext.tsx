import {
  Children,
  Fragment,
  createContext,
  isValidElement,
  useContext,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';
import type { GlobeController } from '../globeController';
import type { GlobeEnginePort, GlobeState, StartViewId } from '../types';

export type CartoonPlanetSlot = 'overlay' | 'root';

export interface CartoonPlanetContextValue {
  globeState: GlobeState;
  controller: GlobeController;
  enginePortRef: RefObject<GlobeEnginePort>;
  flyTo: (lng: number, lat: number, alt_m: number) => void;
  setInitialView: (view: StartViewId) => void;
  selectRenderMode: (mode: string) => void;
  selectPlanetMap: (mapId: string) => void;
  setPlacingMode: (val: boolean) => void;
}

export type CartoonPlanetUiComponent = {
  cartoonPlanetSlot?: CartoonPlanetSlot;
};

const CartoonPlanetContext = createContext<CartoonPlanetContextValue | null>(null);

export function CartoonPlanetProvider({
  value,
  children,
}: {
  value: CartoonPlanetContextValue;
  children: ReactNode;
}) {
  return <CartoonPlanetContext.Provider value={value}>{children}</CartoonPlanetContext.Provider>;
}

export function useCartoonPlanet(): CartoonPlanetContextValue {
  const context = useContext(CartoonPlanetContext);
  if (!context) {
    throw new Error('Cartoon Planet UI components must be rendered inside <CartoonPlanet>.');
  }
  return context;
}

export function assignCartoonPlanetSlot<P>(
  slot: CartoonPlanetSlot,
  Component: (props: P) => ReactNode
): ((props: P) => ReactNode) & CartoonPlanetUiComponent {
  const Wrapped = (props: P) => Component(props);
  Wrapped.cartoonPlanetSlot = slot;
  return Wrapped;
}

function getChildSlot(child: ReactElement): CartoonPlanetSlot {
  const type = child.type as CartoonPlanetUiComponent;
  return type.cartoonPlanetSlot ?? 'root';
}

function flattenUiChildren(children: ReactNode): ReactElement[] {
  const flattened: ReactElement[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) {
      flattened.push(...flattenUiChildren((child.props as { children?: ReactNode }).children));
      return;
    }
    flattened.push(child);
  });

  return flattened;
}

export function CartoonPlanetUiLayer({ children }: { children: ReactNode }) {
  const overlay: ReactNode[] = [];
  const root: ReactNode[] = [];

  for (const child of flattenUiChildren(children)) {
    if (getChildSlot(child) === 'overlay') {
      overlay.push(child);
    } else {
      root.push(child);
    }
  }

  return (
    <>
      {root}
      {overlay.length > 0 && <div className="hud-overlay-container">{overlay}</div>}
    </>
  );
}
