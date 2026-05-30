import { Component, type ErrorInfo, type ReactNode } from 'react';

type InternalV2ErrorBoundaryProps = {
  children: ReactNode;
};

type InternalV2ErrorBoundaryState = {
  hasError: boolean;
};

export class InternalV2ErrorBoundary extends Component<
  InternalV2ErrorBoundaryProps,
  InternalV2ErrorBoundaryState
> {
  state: InternalV2ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): InternalV2ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // Intentionally avoid logging runtime details here: admin tokens must never
    // be exposed through user-visible errors or console output in preview.
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className='shell'>
        <section className='card mx-auto mt-10 max-w-xl p-5 text-center'>
          <p className='text-xs font-bold uppercase tracking-[0.2em] text-rose-200'>
            Internal V2
          </p>
          <h1 className='mt-2 text-2xl font-black'>Algo falló en Internal V2</h1>
          <p className='mt-2 text-sm text-zinc-400'>
            Recarga la consola para volver a un estado seguro. No se muestran
            detalles técnicos en pantalla.
          </p>
          <button
            type='button'
            className='mt-4 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-black'
            onClick={() => window.location.reload()}
          >
            Recargar
          </button>
        </section>
      </main>
    );
  }
}
