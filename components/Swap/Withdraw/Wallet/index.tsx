import { FC } from "react"
import { ApiResponse } from "../../../../Models/ApiResponse"
import { useSettingsState } from "../../../../context/settings"
import { useSwapDataState } from "../../../../context/swap"
import NetworkSettings, { DepositType } from "../../../../lib/NetworkSettings"
import KnownInternalNames from "../../../../lib/knownIds"
import LayerSwapApiClient, { DepositAddress, DepositAddressSource, Fee } from "../../../../lib/layerSwapApiClient"
import TransferFromWallet from "./ERC20Transfer"
import ImtblxWalletWithdrawStep from "./ImtblxWalletWithdrawStep"
import StarknetWalletWithdrawStep from "./StarknetWalletWithdraw"
import useSWR from 'swr'
import { useAccount } from "wagmi"

const WalletTransfer: FC = () => {
    const { swap } = useSwapDataState()
    const { layers } = useSettingsState()
    const { address } = useAccount()
    const { source_network: source_network_internal_name, destination_address, destination_network, destination_network_asset } = swap

    const source_network = layers.find(n => n.internal_name === source_network_internal_name)
    const destination = layers.find(n => n.internal_name === destination_network)
    const sourceCurrency = source_network.assets.find(c => c.asset.toLowerCase() === swap.source_network_asset.toLowerCase())

    const sourceIsImmutableX = swap?.source_network?.toUpperCase() === KnownInternalNames.Networks.ImmutableXMainnet?.toUpperCase() || swap?.source_network === KnownInternalNames.Networks.ImmutableXGoerli?.toUpperCase()
    const sourceIsStarknet = swap?.source_network?.toUpperCase() === KnownInternalNames.Networks.StarkNetMainnet?.toUpperCase() || swap?.source_network === KnownInternalNames.Networks.StarkNetGoerli?.toUpperCase()

    const shouldGetGeneratedAddress =
        !sourceIsStarknet &&
        (address?.toLowerCase() !== destination_address?.toLowerCase()
        || sourceIsImmutableX)

    const layerswapApiClient = new LayerSwapApiClient()
    const generateDepositParams = shouldGetGeneratedAddress ? [source_network_internal_name] : null
    const {
        data: generatedDeposit
    } = useSWR<ApiResponse<DepositAddress>>(generateDepositParams, ([network]) => layerswapApiClient.GenerateDepositAddress(network), { dedupingInterval: 60000 })

    const { data: managedDeposit } = useSWR<ApiResponse<DepositAddress>>(`/deposit_addresses/${source_network_internal_name}?source=${DepositAddressSource.Managed}`, layerswapApiClient.fetcher, { dedupingInterval: 60000 })
    const generatedDepositAddress = generatedDeposit?.data?.address
    const managedDepositAddress = managedDeposit?.data?.address
    const sourceNetworkSettings = NetworkSettings.KnownSettings[source_network_internal_name]
    const sourceChainId = sourceNetworkSettings?.ChainId

    const feeParams = {
        source: source_network_internal_name,
        destination: destination?.internal_name,
        asset: destination_network_asset,
        refuel: swap?.refuel_amount ? true : false
    }

    const { data: feeData } = useSWR<ApiResponse<Fee[]>>([feeParams], ([params]) => layerswapApiClient.GetFee(params), { dedupingInterval: 60000 })
    const walletTransferFee = feeData?.data?.find(f => f?.deposit_type === DepositType.Manual)
    const requested_amount = walletTransferFee?.min_amount > swap?.requested_amount ? walletTransferFee?.min_amount : swap?.requested_amount

    if (sourceIsImmutableX)
        return <Wrapper>
            <ImtblxWalletWithdrawStep generatedDepositAddress={generatedDepositAddress} />
        </Wrapper>
    else if (sourceIsStarknet)
        return <Wrapper>
            <StarknetWalletWithdrawStep amount={requested_amount} managedDepositAddress={managedDepositAddress} />
        </Wrapper>
    return <Wrapper>
        <TransferFromWallet
            swapId={swap.id}
            networkDisplayName={source_network?.display_name}
            tokenDecimals={sourceCurrency?.decimals}
            tokenContractAddress={sourceCurrency?.contract_address as `0x${string}`}
            chainId={sourceChainId as number}
            generatedDepositAddress={generatedDepositAddress as `0x${string}`}
            managedDepositAddress={managedDepositAddress as `0x${string}`}
            userDestinationAddress={swap.destination_address as `0x${string}`}
            amount={requested_amount} />
    </Wrapper>

}

const Wrapper: FC = ({ children }) => {
    return <div className='border-secondary-500 rounded-md border bg-secondary-700 p-3'>
        {children}
    </div>
}

export default WalletTransfer