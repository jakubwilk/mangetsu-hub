import { DocumentsPage } from 'apps/tutorials/page'

import { HubHeader } from '../../_components/HubHeader'

const Page = () => (
  <DocumentsPage
    header={(slots) => <HubHeader appId="tutorials" title="Baza wiedzy" {...slots} />}
  />
)

export default Page
