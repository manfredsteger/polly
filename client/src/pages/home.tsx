import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Vote, Clock, Share2, BarChart3, Shield, FileText, Users, CalendarCheck, Zap, ClipboardList } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { AiChatWidget } from "@/components/ai/AiChatWidget";

export default function Home() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 py-16">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
            {t('home.heroTitleSimple')} <span className="text-schedule">{t('home.heroTitlePlan')}</span>,{" "}
            <span className="text-survey">{t('home.heroTitleVote')}</span> {t('home.heroTitleAnd')}<br />
            <span className="text-organization">{t('home.heroTitleOrg')}</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
            {t('home.heroDescription')}
          </p>
          
          {/* Main Action Buttons - Order matches title: abstimmen (Orange), planen (Green), organisieren (Teal) */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-10">
            <Button asChild variant="feature" className="polly-button-schedule wcag-themed-bg text-white text-lg px-8 py-4 h-auto min-w-[200px] shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 [text-shadow:0_1px_2px_rgba(0,0,0,0.2)]" data-testid="button-create-poll">
              <Link href="/create-poll">
                <Calendar className="w-5 h-5 mr-3" />
                {t('home.findDate')}
              </Link>
            </Button>
            <Button asChild variant="feature" className="polly-button-survey wcag-themed-bg text-white text-lg px-8 py-4 h-auto min-w-[200px] shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 [text-shadow:0_1px_2px_rgba(0,0,0,0.2)]" data-testid="button-create-survey">
              <Link href="/create-survey">
                <Vote className="w-5 h-5 mr-3" />
                {t('home.createSurvey')}
              </Link>
            </Button>
            <Button asChild variant="feature" className="polly-button-organization wcag-themed-bg text-white text-lg px-8 py-4 h-auto min-w-[200px] shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 [text-shadow:0_1px_2px_rgba(0,0,0,0.2)]" data-testid="button-create-organization">
              <Link href="/create-organization">
                <ClipboardList className="w-5 h-5 mr-3" />
                {t('home.createOrg')}
              </Link>
            </Button>
          </div>

          {/* AI Chat Widget */}
          <div className="mb-16 px-4">
            <AiChatWidget />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-muted py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">{t('home.featuresTitle')}</h2>
            <p className="text-lg text-muted-foreground">{t('home.featuresSubtitle')}</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature Cards */}
            <Card className="polly-card p-8 hover:shadow-lg transition-shadow">
              <CardContent className="p-0">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center mb-6">
                  <Clock className="w-6 h-6 text-orange-500 dark:text-orange-400" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">{t('home.featureNoRegistration')}</h3>
                <p className="text-muted-foreground">{t('home.featureNoRegistrationDesc')}</p>
              </CardContent>
            </Card>
            
            <Card className="polly-card p-8 hover:shadow-lg transition-shadow">
              <CardContent className="p-0">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-6">
                  <CalendarCheck className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">{t('home.featureCalendar')}</h3>
                <p className="text-muted-foreground">{t('home.featureCalendarDesc')}</p>
              </CardContent>
            </Card>
            
            <Card className="polly-card p-8 hover:shadow-lg transition-shadow">
              <CardContent className="p-0">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-6">
                  <Share2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">{t('home.featureShare')}</h3>
                <p className="text-muted-foreground">{t('home.featureShareDesc')}</p>
              </CardContent>
            </Card>
            
            <Card className="polly-card p-8 hover:shadow-lg transition-shadow">
              <CardContent className="p-0">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-6">
                  <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">{t('home.featureLiveResults')}</h3>
                <p className="text-muted-foreground">{t('home.featureLiveResultsDesc')}</p>
              </CardContent>
            </Card>
            
            <Card className="polly-card p-8 hover:shadow-lg transition-shadow">
              <CardContent className="p-0">
                <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center mb-6">
                  <Shield className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">{t('home.featureGdpr')}</h3>
                <p className="text-muted-foreground">{t('home.featureGdprDesc')}</p>
              </CardContent>
            </Card>
            
            <Card className="polly-card p-8 hover:shadow-lg transition-shadow">
              <CardContent className="p-0">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center mb-6">
                  <FileText className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">{t('home.featureExport')}</h3>
                <p className="text-muted-foreground">{t('home.featureExportDesc')}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">{t('home.howItWorksTitle')}</h2>
            <p className="text-lg text-muted-foreground">{t('home.howItWorksSubtitle')}</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-schedule rounded-full flex items-center justify-center mx-auto mb-6 shadow-md wcag-themed-bg">
                <span className="text-2xl font-bold text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>1</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">{t('home.step1Title')}</h3>
              <p className="text-muted-foreground">{t('home.step1Desc')}</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-survey rounded-full flex items-center justify-center mx-auto mb-6 shadow-md wcag-themed-bg">
                <span className="text-2xl font-bold text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>2</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">{t('home.step2Title')}</h3>
              <p className="text-muted-foreground">{t('home.step2Desc')}</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-organization rounded-full flex items-center justify-center mx-auto mb-6 shadow-md wcag-themed-bg">
                <span className="text-2xl font-bold text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>3</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">{t('home.step3Title')}</h3>
              <p className="text-muted-foreground">{t('home.step3Desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - background-color fallback for axe accessibility testing */}
      <section className="py-20 cta-gradient-section" style={{ backgroundColor: 'hsl(20, 100%, 47%)', backgroundImage: 'linear-gradient(to right, hsl(17, 100%, 50%), hsl(25, 100%, 45%))' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white drop-shadow-sm mb-6">{t('home.ctaTitle')}</h2>
          <p className="text-xl text-white drop-shadow-sm mb-8 max-w-2xl mx-auto">
            {t('home.ctaDescription')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
            <Button asChild className="bg-white text-gray-900 hover:bg-gray-100 border-2 border-white text-lg px-8 py-3 h-auto">
              <Link href="/create-poll">
                <Calendar className="w-5 h-5 mr-2" />
                {t('home.startSchedulePoll')}
              </Link>
            </Button>
            <Button asChild className="bg-white text-gray-900 hover:bg-gray-100 border-2 border-white text-lg px-8 py-3 h-auto">
              <Link href="/create-survey">
                <Vote className="w-5 h-5 mr-2" />
                {t('home.createSurvey')}
              </Link>
            </Button>
            <Button asChild className="bg-white text-gray-900 hover:bg-gray-100 border-2 border-white text-lg px-8 py-3 h-auto">
              <Link href="/create-organization">
                <ClipboardList className="w-5 h-5 mr-2" />
                {t('home.createOrgList')}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
