import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Vote, Clock, Share2, BarChart3, Shield, FileText, Users, CalendarCheck, Zap, ClipboardList } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 py-16">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
            Einfach <span className="text-schedule">planen</span>,{" "}
            <span className="text-survey">abstimmen</span> und<br />
            <span className="text-organization">organisieren</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
            Erstelle schnell und unkompliziert Terminumfragen oder Umfragen für dein Team. 
            Ohne Registrierung starten oder mit deinem Account für erweiterte Funktionen.
          </p>
          
          {/* Main Action Buttons - Order matches title: abstimmen (Orange), planen (Green), organisieren (Teal) */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
            <Link href="/create-poll">
              <Button className="kita-button-schedule text-lg px-8 py-4 h-auto min-w-[200px] shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200" data-testid="button-create-poll">
                <Calendar className="w-5 h-5 mr-3" />
                Termin finden
              </Button>
            </Link>
            <Link href="/create-survey">
              <Button className="kita-button-survey text-lg px-8 py-4 h-auto min-w-[200px] shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200" data-testid="button-create-survey">
                <Vote className="w-5 h-5 mr-3" />
                Umfrage erstellen
              </Button>
            </Link>
            <Link href="/create-organization">
              <Button className="kita-button-organization text-lg px-8 py-4 h-auto min-w-[200px] shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200" data-testid="button-create-organization">
                <ClipboardList className="w-5 h-5 mr-3" />
                Orga festlegen
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-muted py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">Alles was du brauchst</h2>
            <p className="text-lg text-muted-foreground">Professionelle Abstimmungstools für Teams</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature Cards */}
            <Card className="kita-card p-8 hover:shadow-lg transition-shadow">
              <CardContent className="p-0">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center mb-6">
                  <Clock className="w-6 h-6 text-orange-500 dark:text-orange-400" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">Ohne Registrierung</h3>
                <p className="text-muted-foreground">Erstelle sofort Umfragen ohne Anmeldung. Links per E-Mail erhalten.</p>
              </CardContent>
            </Card>
            
            <Card className="kita-card p-8 hover:shadow-lg transition-shadow">
              <CardContent className="p-0">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-6">
                  <CalendarCheck className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">Kalender-Integration</h3>
                <p className="text-muted-foreground">Terminplanung mit intuitiver Kalenderansicht und Zeitzone-Support.</p>
              </CardContent>
            </Card>
            
            <Card className="kita-card p-8 hover:shadow-lg transition-shadow">
              <CardContent className="p-0">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-6">
                  <Share2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">Einfaches Teilen</h3>
                <p className="text-muted-foreground">QR-Codes, E-Mail-Einladungen und direkte Links für maximale Reichweite.</p>
              </CardContent>
            </Card>
            
            <Card className="kita-card p-8 hover:shadow-lg transition-shadow">
              <CardContent className="p-0">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-6">
                  <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">Live-Ergebnisse</h3>
                <p className="text-muted-foreground">Ergebnisse in Echtzeit verfolgen mit Vollbild-Präsentation für Meetings und Schulungen.</p>
              </CardContent>
            </Card>
            
            <Card className="kita-card p-8 hover:shadow-lg transition-shadow">
              <CardContent className="p-0">
                <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center mb-6">
                  <Shield className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">DSGVO-konform</h3>
                <p className="text-muted-foreground">Sichere Datenverarbeitung nach deutschen Datenschutzstandards.</p>
              </CardContent>
            </Card>
            
            <Card className="kita-card p-8 hover:shadow-lg transition-shadow">
              <CardContent className="p-0">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center mb-6">
                  <FileText className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">Export-Optionen</h3>
                <p className="text-muted-foreground">CSV und PDF-Export für Dokumentation und weitere Verwendung.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">So einfach geht's</h2>
            <p className="text-lg text-muted-foreground">In wenigen Schritten zur perfekten Abstimmung</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-schedule rounded-full flex items-center justify-center mx-auto mb-6 shadow-md">
                <span className="text-2xl font-bold text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>1</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">Umfrage erstellen</h3>
              <p className="text-muted-foreground">Wähle zwischen Terminumfrage und klassischer Umfrage. Füge Optionen hinzu und konfiguriere deine Einstellungen.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-survey rounded-full flex items-center justify-center mx-auto mb-6 shadow-md">
                <span className="text-2xl font-bold text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>2</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">Teilnehmer einladen</h3>
              <p className="text-muted-foreground">Teile den Link per E-Mail, QR-Code oder direkt mit deinem Team. Keine Registrierung für Teilnehmer erforderlich.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-organization rounded-full flex items-center justify-center mx-auto mb-6 shadow-md">
                <span className="text-2xl font-bold text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>3</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">Ergebnisse auswerten</h3>
              <p className="text-muted-foreground">Verfolge die Abstimmung in Echtzeit, exportiere Ergebnisse und treffe fundierte Entscheidungen.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-[hsl(17,100%,50%)] to-[hsl(25,100%,45%)] py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white drop-shadow-sm mb-6">Bereit für bessere Abstimmungen?</h2>
          <p className="text-xl text-white drop-shadow-sm mb-8 max-w-2xl mx-auto">
            Starte noch heute mit deiner ersten Umfrage und erlebe, wie einfach Teamkoordination sein kann.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
            <Link href="/create-poll">
              <Button className="bg-white text-kita-orange hover:bg-gray-100 border-2 border-white text-lg px-8 py-3 h-auto">
                <Calendar className="w-5 h-5 mr-2" />
                Terminumfrage starten
              </Button>
            </Link>
            <Link href="/create-survey">
              <Button className="bg-white text-kita-orange hover:bg-gray-100 border-2 border-white text-lg px-8 py-3 h-auto">
                <Vote className="w-5 h-5 mr-2" />
                Umfrage erstellen
              </Button>
            </Link>
            <Link href="/create-organization">
              <Button className="bg-white text-kita-orange hover:bg-gray-100 border-2 border-white text-lg px-8 py-3 h-auto">
                <ClipboardList className="w-5 h-5 mr-2" />
                Orga-Liste erstellen
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
