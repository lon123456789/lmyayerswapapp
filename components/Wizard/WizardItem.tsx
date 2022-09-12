import { FC, forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import { Transition } from "@headlessui/react";
import { ArrowLeftIcon } from '@heroicons/react/solid';
import { useFormWizardaUpdate, useFormWizardState } from '../../context/formWizardProvider';
import { BaseWizard, ProcessSwapStep, SwapCreateStep } from '../../Models/Wizard';
import LayerswapMenu from '../LayerswapMenu';
import LayerSwapLogo from '../icons/layerSwapLogo';
import { useRouter } from 'next/router';

type Props = {
    StepName: SwapCreateStep | ProcessSwapStep,
    PositionPercent?: number,
    GoBack?: () => void,
    children: JSX.Element | JSX.Element[];
}

const WizardItem: FC<Props> = (({ StepName, children, GoBack, PositionPercent }) => {
    const { currentStepName, moving, wrapperWidth } = useFormWizardState()
    const { setGoBack, setPositionPercent } = useFormWizardaUpdate()

    useEffect(() => {
        if (currentStepName === StepName) {
            setGoBack(GoBack)
            setPositionPercent(PositionPercent)
        }
    }, [currentStepName, GoBack, PositionPercent, StepName])

    return <Transition
        appear={false}
        unmount={false}
        show={StepName === currentStepName}
        enter="transform transition ease-in-out duration-500"
        enterFrom={
            moving === "right"
                ? `translate-x-96 opacity-0`
                : `-translate-x-96 opacity-0`
        }
        enterTo={`translate-x-0 opacity-100`}
        leave="transform transition ease-in-out duration-500"
        leaveFrom={`translate-x-0 opacity-100`}
        leaveTo={
            moving === "right"
                ? `-translate-x-96 opacity-0`
                : `translate-x-96 opacity-0`
        }
        className={`${StepName === currentStepName ? 'w-full' : 'w-0'} overflow-visible`}
        as="div"
    >
        <div
            style={{ width: `${wrapperWidth}px`, minHeight: '504px', height: '100%' }}>
            {children}
        </div>
    </Transition>
})

export default WizardItem;