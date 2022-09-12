import React from 'react';
import { FC } from 'react'
import { SwapDataProvider } from '../context/swap';
import { AuthProvider } from '../context/authContext';
import { UserExchangeProvider } from '../context/userExchange';
import Wizard from './Wizard/Wizard';
import { MenuProvider } from '../context/menu';
import IntroCard from './introCard';
import CreateSwap from './Wizard/CreateSwap';
import { SwapCreateStep } from '../Models/Wizard';
import { FormWizardProvider } from '../context/formWizardProvider';




const Swap: FC = () => {

  return (
    <div>
      <div className="text-white">
        <AuthProvider>
          <MenuProvider>
            <SwapDataProvider >
              <UserExchangeProvider>
                <FormWizardProvider initialStep={SwapCreateStep.MainForm} initialLoading={true}>
                  <CreateSwap />
                </FormWizardProvider>
              </UserExchangeProvider>
            </SwapDataProvider >
          </MenuProvider>
        </AuthProvider>
        <IntroCard />
      </div >
    </div >
  )
};

export default Swap;