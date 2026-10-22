import { TutorialsPage } from 'apps/tutorials/page'

import { HubHeader } from '../_components/HubHeader'

const Page = () => <TutorialsPage header={(slots) => <HubHeader appId="tutorials" {...slots} />} />

export default Page
