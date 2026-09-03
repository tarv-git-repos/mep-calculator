import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/busbar-calculation')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/busbar-calculation"!</div>
}
