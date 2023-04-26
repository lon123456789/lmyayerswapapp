import { Form, FormikErrors, useFormikContext } from "formik";
import { FC, useCallback, useEffect, useRef, useState } from "react";

import Image from 'next/image';
import SwapButton from "../../../buttons/swapButton";
import React from "react";
import SelectNetwork from "../../../Select/SelectNetwork";
import AmountField from "../../../Input/Amount";
import LayerSwapApiClient, { AddressBookItem, SwapType, UserExchangesData } from "../../../../lib/layerSwapApiClient";
import { SwapFormValues } from "../../../DTOs/SwapFormValues";
import { Partner } from "../../../../Models/Partner";
import Widget from "../../Widget";
import AmountAndFeeDetails from "../../../DisclosureComponents/amountAndFeeDetailsComponent";
import Modal from "../../../modal/modal";
import OfframpAccountConnectStep from "../../../OfframpAccountConnect";
import toast from "react-hot-toast";
import { useRouter } from "next/router";
import { KnownwErrorCode } from "../../../../Models/ApiError";
import { useSwapDataState, useSwapDataUpdate } from "../../../../context/swap";
import ConnectApiKeyExchange from "../../../connectApiKeyExchange";
import SpinIcon from "../../../icons/spinIcon";
import { useQueryState } from "../../../../context/query";
import { useSettingsState } from "../../../../context/settings";
import { isValidAddress } from "../../../../lib/addressValidator";
import { CalculateMinAllowedAmount } from "../../../../lib/fees";
import Address from "../../../Input/Address";
import NetworkSettings from "../../../../lib/NetworkSettings";
import shortenAddress from "../../../utils/ShortenAddress";
import useSWR from "swr";
import { ApiResponse } from "../../../../Models/ApiResponse";
import { motion, useCycle } from "framer-motion";
import ClickTooltip from "../../../Tooltips/ClickTooltip";
import ToggleButton from "../../../buttons/toggleButton";
import { ArrowUpDown, Fuel } from 'lucide-react'
import { useAuthState } from "../../../../context/authContext";
import WarningMessage from "../../../WarningMessage";
import { NetworkCurrency } from "../../../../Models/CryptoNetwork";
import { GetDefaultNetwork, GetNetworkCurrency } from "../../../../helpers/settingsHelper";

type Props = {
    isPartnerWallet: boolean,
    partner?: Partner,
    resource_storage_url: string,
    loading: boolean
}
const SwapForm: FC<Props> = ({ partner, isPartnerWallet, resource_storage_url, loading }) => {

    const {
        values,
        setValues,
        errors, isValid, isSubmitting, setFieldValue
    } = useFormikContext<SwapFormValues>();
    const { to } = values
    const settings = useSettingsState();
    const destination = values.to?.baseObject
    const source = values.from?.baseObject
    const asset = values.currency?.baseObject?.asset
    const { authData } = useAuthState()
    const layerswapApiClient = new LayerSwapApiClient()
    const address_book_endpoint = authData?.access_token ? `/address_book/recent` : null
    const { data: address_book, mutate, isValidating } = useSWR<ApiResponse<AddressBookItem[]>>(address_book_endpoint, layerswapApiClient.fetcher, { dedupingInterval: 60000 })

    const [openExchangeConnect, setOpenExchangeConnect] = useState(false)
    const [exchangeAccount, setExchangeAccount] = useState<UserExchangesData>()
    const minAllowedAmount = CalculateMinAllowedAmount(values, settings.networks, settings.currencies);
    const partnerImage = partner?.internal_name ? `${resource_storage_url}/layerswap/partners/${partner?.internal_name?.toLowerCase()}.png` : null
    const router = useRouter();
    const [loadingDepositAddress, setLoadingDepositAddress] = useState(false)
    const { setDepositeAddressIsfromAccount, setAddressConfirmed } = useSwapDataUpdate()
    const { depositeAddressIsfromAccount } = useSwapDataState()
    const query = useQueryState();
    const [valuesSwapperDisabled, setValuesSwapperDisabled] = useState(true)
    const [showAddressModal, setShowAddressModal] = useState(false);
    const lockAddress =
        (values.destination_address && values.to)
        && isValidAddress(values.destination_address, values.to?.baseObject)
        && ((query.lockAddress && (query.addressSource !== "imxMarketplace" || settings.validSignatureisPresent)));

    const handleConfirmToggleChange = (value: boolean) => {
        setFieldValue('refuel', value)
    }

    const handleSetExchangeDepositAddress = useCallback(async () => {
        setLoadingDepositAddress(true)
        const layerswapApiClient = new LayerSwapApiClient(router)
        try {
            const exchange_account = await layerswapApiClient.GetExchangeAccount(to?.baseObject.internal_name, 0)
            setExchangeAccount(exchange_account.data)
            const deposit_address = await layerswapApiClient.GetExchangeDepositAddress(to?.baseObject.internal_name, values?.currency?.baseObject?.asset)
            setFieldValue("destination_address", deposit_address.data)
            setDepositeAddressIsfromAccount(true)
            setLoadingDepositAddress(false)
        }
        catch (e) {
            if (e?.response?.data?.error?.code === KnownwErrorCode.NOT_FOUND || e?.response?.data?.error?.code === KnownwErrorCode.INVALID_CREDENTIALS)
                setOpenExchangeConnect(true)
            else {
                toast(e?.response?.data?.error?.message || e.message)
                setLoadingDepositAddress(false)
            }
        }
    }, [values])

    const depositeAddressIsfromAccountRef = useRef(depositeAddressIsfromAccount);

    useEffect(() => {
        depositeAddressIsfromAccountRef.current = depositeAddressIsfromAccount
        return () => depositeAddressIsfromAccountRef.current = null
    }, [depositeAddressIsfromAccount])

    const handleExchangeConnected = useCallback(async () => {
        if (!to || !values.currency)
            return
        setLoadingDepositAddress(true)
        try {
            const layerswapApiClient = new LayerSwapApiClient(router)
            const deposit_address = await layerswapApiClient.GetExchangeDepositAddress(to?.baseObject?.internal_name, values?.currency?.baseObject?.asset)
            setFieldValue("destination_address", deposit_address.data)
            setDepositeAddressIsfromAccount(true)
        }
        catch (e) {
            toast(e?.response?.data?.error?.message || e.message)
        }
        setLoadingDepositAddress(false)
    }, [values])

    useEffect(() => {
        if (depositeAddressIsfromAccountRef.current)
            handleExchangeConnected()
        if (!destination?.isExchange && !GetNetworkCurrency(source, asset)?.is_refuel_enabled) {
            handleConfirmToggleChange(false)
        }
    }, [asset, destination])

    useEffect(() => {
        setAddressConfirmed(false)
    }, [source])

    useEffect(() => {
        if (!destination?.isExchange && values.refuel && values.amount && Number(values.amount) < minAllowedAmount) {
            setFieldValue('amount', minAllowedAmount)
        }
    }, [values.refuel, destination])

    const exchangeRef = useRef(to?.id);

    useEffect(() => {
        if (!destination?.isExchange && exchangeRef.current && exchangeRef.current !== to?.id) {
            setFieldValue("destination_address", '')
            setDepositeAddressIsfromAccount(false)
        }
        exchangeRef.current = to?.id
    }, [to, destination])

    useEffect(() => {
        if (!destination?.isExchange && values.refuel && Number(values.amount) < minAllowedAmount) {
            setFieldValue('amount', minAllowedAmount)
        }
    }, [values.refuel, destination])

    const valuesSwapper = useCallback(() => {
        if (!source?.isExchange && !destination?.isExchange)
            setValues({ ...values, from: values.to, to: values.from }, true)
    }, [values])

    const valuesSwapperFiltering = () => {
        const sourceCurrencyIsAvailable = source
            ?.layer2Assets
            ?.some(a => a.is_default
                && a.network
                    ?.currencies
                    ?.some(c => c.is_deposit_enabled
                        && c.is_withdrawal_enabled))

        const destCurrencyIsAvailable = destination
            ?.layer2Assets
            ?.some(a => a.is_default
                && a.network
                    ?.currencies
                    ?.some(c => c.is_deposit_enabled
                        && c.is_withdrawal_enabled))

        if ((values.from && !values.to && sourceCurrencyIsAvailable) || (values.to && !values.from && destCurrencyIsAvailable)) setValuesSwapperDisabled(false)
        else if (values.from && values.to && sourceCurrencyIsAvailable && destCurrencyIsAvailable) setValuesSwapperDisabled(false)
        else setValuesSwapperDisabled(true)
    }
    const [animate, cycle] = useCycle(
        { rotate: 0 },
        { rotate: 180 }
    );
    useEffect(() => {
        valuesSwapperFiltering()
    }, [source, destination])

    const destinationNetwork = GetDefaultNetwork(destination, values?.currency?.baseObject?.asset)
    const destination_native_currency = !destination?.isExchange && destinationNetwork?.native_currency
    return <>
        <Form className="h-full" >
            <Widget>
                {loading ?
                    <div className="w-full h-full flex items-center"><SpinIcon className="animate-spin h-8 w-8 grow" /></div>
                    : <Widget.Content>
                        <div className='flex-col relative flex justify-between w-full space-y-4 mb-3.5 leading-4'>
                            <div className="flex flex-col w-full">
                                <SelectNetwork direction="from" label="From" />
                            </div>
                            {
                                !source?.isExchange && !destination?.isExchange && !valuesSwapperDisabled &&
                                <button type="button" disabled={valuesSwapperDisabled} onClick={valuesSwapper} className='absolute right-[calc(50%-16px)] top-[65px] z-10 rounded-full bg-darkblue-900 ring-1 ring-darkblue-400 hover:ring-primary py-1.5 p-1 hover:text-primary disabled:opacity-30 disabled:ring-0 disabled:text-primary-text duration-200 transition'>
                                    <motion.div
                                        animate={animate}
                                        transition={{ duration: 0.3 }}
                                        onTap={() => !valuesSwapperDisabled && cycle()}
                                    >
                                        <ArrowUpDown className="h-5" />
                                    </motion.div>
                                </button>
                            }
                            <div className="flex flex-col w-full">
                                <SelectNetwork direction="to" label="To" />
                            </div>
                        </div>
                        <div className="mb-6 leading-4">
                            <AmountField />
                        </div>
                        <div className="w-full mb-3.5 leading-4">
                            <label htmlFor="destination_address" className="block font-semibold text-primary-text text-sm">
                                {`To ${values?.to?.name || ''} address`}
                            </label>
                            <AddressButton
                                disabled={!values.to || !values.from}
                                isPartnerWallet={isPartnerWallet}
                                openAddressModal={() => setShowAddressModal(true)}
                                partnerImage={partnerImage}
                                values={values} />
                            <Modal
                                header={`To ${values?.to?.name || ''} address`}
                                height="fit"
                                show={showAddressModal} setShow={setShowAddressModal}>
                                <Address
                                    close={() => setShowAddressModal(false)}
                                    onSetExchangeDepoisteAddress={handleSetExchangeDepositAddress}
                                    exchangeAccount={exchangeAccount}
                                    loading={loadingDepositAddress}
                                    disabled={lockAddress || (!values.to || !values.from) || loadingDepositAddress}
                                    name={"destination_address"}
                                    partnerImage={partnerImage}
                                    isPartnerWallet={isPartnerWallet}
                                    partner={partner}
                                    address_book={address_book?.data}
                                />
                            </Modal>
                        </div>
                        <div className="w-full">
                            {
                                !destination?.isExchange && GetNetworkCurrency(source, asset)?.is_refuel_enabled &&
                                <div className="flex items-center justify-between px-3.5 py-3 bg-darkblue-700 border border-darkblue-500 rounded-lg mb-4">
                                    <div className="flex items-center space-x-2">
                                        <Fuel className='h-8 w-8 text-primary' />
                                        <div>
                                            <p className="font-medium flex items-center">
                                                <span>Need gas?</span>
                                                <ClickTooltip text={`You will get a small amount of ${destination_native_currency} that you can use to pay for gas fees.`} />
                                            </p>
                                            <p className="font-light text-xs">
                                                Get <span className="font-semibold">{destination_native_currency}</span> to pay fees in {values.to.baseObject.display_name}
                                            </p>
                                        </div>
                                    </div>
                                    <ToggleButton name="refuel" value={values?.refuel} onChange={handleConfirmToggleChange} />
                                </div>
                            }
                            <AmountAndFeeDetails values={values} />
                            {
                                //TODO refactor
                                GetNetworkCurrency(source, asset)?.status == 'insufficient_liquidity' &&
                                <WarningMessage messageType="warning" className="mt-4">
                                    <>We're experiencing delays for transfers to {values?.to?.name}. Estimated arrival time can take up to 2 hours.</>
                                </WarningMessage>
                            }
                        </div>
                    </Widget.Content>
                }
                <Widget.Footer>
                    <SwapButton className="plausible-event-name=Swap+initiated" type='submit' isDisabled={!isValid || loading} isSubmitting={isSubmitting || loading}>
                        {displayErrorsOrSubmit(errors)}
                    </SwapButton>
                </Widget.Footer>
            </Widget>
            {destination?.isExchange &&
                <Modal setShow={setOpenExchangeConnect} show={openExchangeConnect} header={`Connect ${values?.to?.baseObject?.display_name}`} >
                    {
                        (destination?.authorization_flow) === "o_auth2" ?
                            <OfframpAccountConnectStep OnSuccess={async () => { await handleExchangeConnected(); setOpenExchangeConnect(false) }} />
                            : <ConnectApiKeyExchange exchange={destination} onSuccess={async () => { handleExchangeConnected(); setOpenExchangeConnect(false) }} />
                    }
                </Modal>
            }
        </Form >
    </>
}

function displayErrorsOrSubmit(errors: FormikErrors<SwapFormValues>): string {
    return errors.from?.toString() || errors.to?.toString() || errors.amount || errors.destination_address || "Swap now"
}

const TruncatedAdrress = ({ address }: { address: string }) => {
    return <div className="tracking-wider text-white">{shortenAddress(address)}</div>
}

type AddressButtonProps = {
    openAddressModal: () => void;
    isPartnerWallet: boolean;
    values: SwapFormValues;
    partnerImage: string;
    disabled: boolean;
}
const AddressButton: FC<AddressButtonProps> = ({ openAddressModal, isPartnerWallet, values, partnerImage, disabled }) => {
    const destination = values?.to?.baseObject
    return <button type="button" disabled={disabled} onClick={openAddressModal} className="flex rounded-lg space-x-3 items-center cursor-pointer shadow-sm mt-1.5 bg-darkblue-700 border-darkblue-500 border disabled:cursor-not-allowed h-12 leading-4 focus:ring-primary focus:border-primary font-semibold w-full placeholder-gray-400 px-3.5 py-3">
        {isPartnerWallet && !destination.isExchange &&
            <div className="shrink-0 flex items-center pointer-events-none">
                {
                    partnerImage &&
                    <Image alt="Partner logo" className='rounded-md object-contain' src={partnerImage} width="24" height="24"></Image>
                }
            </div>
        }
        <div className="truncate">
            {values.destination_address ?
                <TruncatedAdrress address={values.destination_address} />
                :
                (NetworkSettings.KnownSettings[values?.to?.baseObject?.internal_name]?.AddressPlaceholder ?? "0x123...ab56c")}
        </div>
    </button>
}



export default SwapForm