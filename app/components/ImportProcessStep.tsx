import {useEffect, useMemo, useRef, useState} from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Box,
  InlineStack,
  Button
} from "@shopify/polaris";
import {useNavigate} from "@remix-run/react";
import { PlayIcon, StopCircleIcon, ArrowLeftIcon } from "@shopify/polaris-icons";

interface ImportSummaryProps {
  dataSource: 'api' | 'csv';
  apiCredentials: { apiUrl: string; accessToken: string };
  csvData: { fileName?: string } | null;
  keyMappings: Record<string, string>;
  importFilters: { selectedAttributes: string[]; selectedValues: string[] };
  markupConfig: {
    conditions: Array<any>;
    conditionsType: 'all' | 'any';
    tieBreaker: 'higher' | 'lower' | 'priority';
  };
  importConfig: 'draft' | 'published';
  productCount: number;
}

export default function ImportProcessStep(props: ImportSummaryProps) {
  const navigate = useNavigate();

  const [isImporting, setIsImporting] = useState(false);
  const [running, setRunning] = useState(false);
  const [success, setSuccess] = useState(0);
  const [failed, setFailed] = useState(0);
  const [total, setTotal] = useState(0);
  const [currentProduct, setCurrentProduct] = useState('');
  const [importSessionId, setImportSessionId] = useState('');

  const processed = success + failed;
  const remaining = Math.max(0, total - processed); // Prevent negative values
  const progress = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

  // Real-time progress tracking
  useEffect(() => {
    console.log('🔄 Progress tracking useEffect triggered:', { isImporting, running, importSessionId });
    
    if (!isImporting || !running || !importSessionId) {
      console.log('🛑 Progress tracking stopped:', { isImporting, running, importSessionId });
      return;
    }
    
    console.log('🔄 Starting progress tracking with session ID:', importSessionId);
    
    const progressInterval = setInterval(async () => {
      try {
        console.log('📊 Fetching progress for session:', importSessionId);
        const response = await fetch(`/app/api/shopify?action=getProgress&sessionId=${importSessionId}`);
        const data = await response.json();
        
        console.log('📈 Raw progress data:', data);
        
        if (data.success) {
          const newImported = data.imported || 0;
          const newFailed = data.failed || 0;
          const newTotal = data.totalProducts || 0;
          const newCurrentProduct = data.currentProduct || 'Processing...';
          
          console.log('✅ Progress update received:', {
            imported: newImported,
            failed: newFailed,
            total: newTotal,
            currentProduct: newCurrentProduct,
            processed: newImported + newFailed,
            remaining: Math.max(0, newTotal - (newImported + newFailed)),
            progressPercent: newTotal > 0 ? Math.round(((newImported + newFailed) / newTotal) * 100) : 0
          });
          
          // Check if values actually changed
          const hasChanged = newImported !== success || newFailed !== failed || newTotal !== total;
          console.log('🔄 Values changed?', hasChanged, {
            oldSuccess: success, newSuccess: newImported,
            oldFailed: failed, newFailed: newFailed,
            oldTotal: total, newTotal: newTotal
          });
          
          if (hasChanged) {
            console.log('🔄 Updating state with new values...');
            setSuccess(newImported);
            setFailed(newFailed);
            setTotal(newTotal);
            setCurrentProduct(newCurrentProduct);
          }
          
          // Stop if import is complete
          if (newTotal > 0 && (newImported + newFailed) >= newTotal) {
            console.log('🎉 Import completed!');
            setRunning(false);
            setIsImporting(false);
          }
        } else {
          console.error('❌ Progress request failed:', data.error);
        }
      } catch (error) {
        console.error('❌ Progress tracking error:', error);
      }
    }, 50); // Check every 50ms for real-time updates
    
    return () => {
      console.log('🛑 Progress tracking stopped');
      clearInterval(progressInterval);
    };
  }, [isImporting, running, importSessionId]);

  // stop automatically when done
  useEffect(() => {
    console.log('🔄 Completion check:', { processed, total, running });
    if (processed >= total && running && total > 0) {
      console.log('🎉 Import completed, stopping...');
      setRunning(false);
      setIsImporting(false);
    }
  }, [processed, total, running]);

  function buildProductsFromState() {
    // Build complete import configuration
    const importConfig = {
      dataSource: props.dataSource,
      importType: 'all', // Keep it simple
      importConfig: props.importConfig,
      keyMappings: props.keyMappings,
      importFilters: props.importFilters, // Keep original filters
      markupConfig: props.markupConfig,
      totalProducts: props.productCount,
      // Add actual data source
      csvData: props.dataSource === 'csv' ? props.csvData : null,
      apiCredentials: props.dataSource === 'api' ? props.apiCredentials : null
    };

    return importConfig;
  }

  function startImport() {
    console.log('Starting import with product count:', props.productCount);
    setIsImporting(true);
    setRunning(true);
    setSuccess(0);
    setFailed(0);
    setTotal(props.productCount); // Initialize with expected product count
    
    // Send complete configuration to backend
    try {
      const importConfig = buildProductsFromState();
      console.log('Sending import config:', {
        dataSource: importConfig.dataSource,
        hasCsvData: !!importConfig.csvData,
        hasApiCredentials: !!importConfig.apiCredentials,
        csvRows: (importConfig.csvData as any)?.rows?.length || 0,
        keyMappings: importConfig.keyMappings,
        importFilters: importConfig.importFilters
      });
      
      const fd = new FormData();
      fd.append('action', 'bulkCreateProducts');
      fd.append('data', JSON.stringify(importConfig));
      
      console.log('🚀 Starting import request...');
      
      // Main import request - Simplified
      console.log('🚀 Starting import request...');
      
      fetch('/app/api/shopify?action=bulkCreateProducts', { 
        method: 'POST', 
        body: fd,
        signal: AbortSignal.timeout(120000) // 2 minute timeout for large imports
        // Remove Content-Type header - let browser set it for FormData
      })
        .then(resp => resp.json())
        .then(data => {
          console.log('📊 Import response:', data);
          
          if (data.success) {
            console.log('✅ Import successful!');
            console.log('📋 Session ID received:', data.sessionId);
            setImportSessionId(data.sessionId || '');
            setTotal(data.totalProducts || props.productCount);
            setCurrentProduct('Import completed!');
            setSuccess(data.imported || 0);
            setFailed(data.failed || 0);
            
            // Keep running for progress tracking if session ID exists
            if (data.sessionId) {
              console.log('🔄 Keeping import running for progress tracking...');
              setRunning(true);
              setIsImporting(true);
            } else {
              console.log('🛑 No session ID, stopping import');
              setRunning(false);
              setIsImporting(false);
            }
                    } else {
            console.error('❌ Import failed:', data.error);
            console.error('❌ Full error response:', data);
            if (data.error?.includes('Authentication')) {
              console.error('🔐 Authentication error - please refresh the page');
              setCurrentProduct('Authentication error - please refresh');
            } else if (data.error?.includes('Shopify API')) {
              console.error('🛒 Shopify API error - check configuration');
              setCurrentProduct('Shopify API error - check config');
            } else {
              setCurrentProduct(`Error: ${data.error}`);
            }
            setFailed(1);
            setRunning(false);
            setIsImporting(false);
          }
        })
        .catch(err => {
          console.error('❌ Import error:', err);
          console.error('❌ Error name:', err.name);
          console.error('❌ Error message:', err.message);
          
          if (err.name === 'TimeoutError') {
            console.error('❌ Request timed out after 2 minutes - backend still processing');
            console.log('🔄 Backend is still processing products, check progress...');
          } else if (err.name === 'AbortError') {
            console.error('❌ Request was aborted');
          } else if (err.name === 'TypeError' && err.message.includes('fetch')) {
            console.error('❌ Network error - check connection');
          }
          
          setFailed(1);
          setRunning(false);
          setIsImporting(false);
        });
    } catch (error) {
      console.error('Import setup error:', error);
      setFailed(1);
      setRunning(false);
    }
  }

  const mappingsCount = Object.keys(props.keyMappings || {}).length;
  const importModeLabel = props.importConfig === 'published' ? 'Published' : 'Draft';
  const sourceLabel = props.dataSource === 'api' ? 'API Source' : 'CSV Source';
  const sourceValue = props.dataSource === 'api' ? (props.apiCredentials?.apiUrl || '') : (props.csvData?.fileName || '');
  const filtersLabel = props.importFilters?.selectedAttributes?.length ? `${props.importFilters.selectedAttributes.length} attributes` : 'No filters';
  const markupCount = props.markupConfig?.conditions?.length || 0;

  return (
    <Card>
    <Page title="Step 7: Import Process" subtitle="Review your configuration and start the import process">
      <Layout>
        {!isImporting && (
          <Layout.Section> 
              <Box  >
                <div style={{display:'flex', gap:12, flexWrap:'wrap', marginBottom:'20px'}}>
                  <div style={{background:'#eef3ff', borderRadius:12, padding:14, minWidth:200}}>
                    <InlineStack gap="300" blockAlign="center">
                      <div style={{width:28,height:28,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',background:'#dbe6ff',color:'#1740ff',fontSize:16,fontWeight:700}}>🌐</div>
                      <div>
                        <Text as="p" variant="bodyMd" fontWeight="semibold">{sourceLabel}</Text>
                        <Text as="span" tone="subdued" variant="bodySm">{sourceValue || '—'}</Text>
                      </div>
                    </InlineStack>
                  </div>
                  <div style={{background:'#ecfff2', borderRadius:12, padding:14, minWidth:200}}>
                    <InlineStack gap="300" blockAlign="center">
                      <div style={{width:28,height:28,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',background:'#d7f7e0',color:'#1a7f37',fontSize:16,fontWeight:700}}>✓</div>
                      <div>
                        <Text as="p" variant="bodyMd" fontWeight="semibold">Key Mappings</Text>
                        <Text as="span" tone="subdued" variant="bodySm">{mappingsCount} fields mapped</Text>
                      </div>
                    </InlineStack>
                  </div>
                  <div style={{background:'#eef5ff', borderRadius:12, padding:14, minWidth:200}}>
                    <InlineStack gap="300" blockAlign="center">
                      <div style={{width:28,height:28,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',background:'#e4ecff',color:'#4a5cff',fontSize:16,fontWeight:700}}>⏳</div>
                      <div>
                        <Text as="p" variant="bodyMd" fontWeight="semibold">Import Filter</Text>
                        <Text as="span" tone="subdued" variant="bodySm">{filtersLabel}</Text>
                      </div>
                    </InlineStack>
                  </div>
                  <div style={{background:'#f5efff', borderRadius:12, padding:14, minWidth:200}}>
                    <InlineStack gap="300" blockAlign="center">
                      <div style={{width:28,height:28,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',background:'#ece2ff',color:'#7a27ff',fontSize:16,fontWeight:700}}>$</div>
                      <div>
                        <Text as="p" variant="bodyMd" fontWeight="semibold">Markup Rules</Text>
                        <Text as="span" tone="subdued" variant="bodySm">{markupCount} conditions</Text>
                      </div>
                    </InlineStack>
                  </div>
                  <div style={{background:'#fff5e9', borderRadius:12, padding:14, minWidth:200}}>
                    <InlineStack gap="300" blockAlign="center">
                      <div style={{width:28,height:28,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',background:'#ffe8cc',color:'#c76b00',fontSize:16,fontWeight:700}}>📝</div>
                      <div>
                        <Text as="p" variant="bodyMd" fontWeight="semibold">Import Mode</Text>
                        <Text as="span" tone="subdued" variant="bodySm">{importModeLabel}</Text>
                      </div>
                    </InlineStack>
                  </div>
                </div>

                <InlineStack gap="200"  >
                  <Button icon={PlayIcon} onClick={startImport}>Start Import</Button>
                  <Button onClick={() => navigate('/app/connection-management')} variant="secondary">Go to Dashboard</Button>
                </InlineStack>
              </Box> 
          </Layout.Section>
        )}

        {isImporting && (
          <Layout.Section>
            <Card>
              <Box padding="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h3" variant="headingMd">Import Progress</Text>
                  <Button
                    icon={running ? StopCircleIcon : PlayIcon}
                    onClick={() => setRunning((r) => !r)}
                    disabled={processed >= total}
                  >
                    {running ? 'Pause' : 'Resume'}
                  </Button>
                </InlineStack>

                {/* progress bar */}
                <div style={{marginTop:12, height:12, background:'#f3f4f6', borderRadius:8, overflow:'hidden', position:'relative'}}>
                  <div 
                    key={`progress-${progress}-${processed}`}
                    style={{
                      width: `${progress}%`, 
                      height:'100%', 
                      background:'linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%)',
                      transition:'width 0.1s ease-out',
                      borderRadius: '8px',
                      position: 'relative'
                    }} 
                  />
                  {/* Progress percentage overlay */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                    pointerEvents: 'none'
                  }}>
                    {progress}%
                  </div>
                  {/* Animated shimmer effect */}
                  {progress > 0 && progress < 100 && (
                    <div 
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                        animation: 'shimmer 1s infinite',
                        borderRadius: '8px'
                      }}
                    />
                  )}
                </div>
                
                {/* Add shimmer animation CSS */}
                <style>{`
                  @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                  }
                `}</style>
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="p" tone="subdued" variant="bodySm">
                    {processed}/{total} products processed
                  </Text>
                  <Text as="p" tone="subdued" variant="bodySm">
                    {progress}% complete
                  </Text>
                  <Text as="p" tone="subdued" variant="bodySm">
                    {remaining} remaining
                  </Text>
                </InlineStack>
                
                {/* Debug info */}
                <div style={{fontSize: '12px', marginTop: '8px', color: '#6d7175'}}>
                  Debug: Success={success}, Failed={failed}, Total={total}, Remaining={remaining}
                </div>

                {/* current processing line */}
                <Box padding="300" borderRadius="300" background="bg-surface-secondary">
                  <InlineStack align="center" gap="200">
                    <div style={{
                      animation: 'pulse 1.5s infinite',
                      display: 'inline-block'
                    }}>
                      <Text as="span" variant="bodyMd">🔄</Text>
                    </div>
                    <Text as="span">Processing: </Text>
                    <Text as="span" fontWeight="semibold">{currentProduct || 'Starting import...'}</Text>
                    <Text as="span" tone="subdued" variant="bodySm">
                      ({processed}/{total})
                    </Text>
                    <Text as="span" tone="success" variant="bodySm">
                      {progress}% complete
                    </Text>
                  </InlineStack>
                </Box>
                
                {/* Add pulse animation CSS */}
                <style>{`
                  @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                  }
                `}</style>

                {/* failed products info */}
                {failed > 0 && (
                  <Box padding="300" borderRadius="300" background="bg-surface-critical">
                    <InlineStack align="center" gap="200">
                      <Text as="span" variant="bodyMd">⚠️</Text>
                      <Text as="span" tone="critical">{failed} products failed/skipped</Text>
                    </InlineStack>
                  </Box>
                )}

                {/* status boxes */}
                <div style={{display:'flex', gap:16, marginTop:16, flexWrap:'wrap'}}>
                  <div style={{flex:1, minWidth:220, background:'#ecfff2', borderRadius:12, padding:18, textAlign:'center'}}>
                    <Text as="h2" variant="headingLg" tone="success">{success}</Text>
                    <Text as="p" tone="subdued">Successful</Text>
                  </div>
                  <div style={{flex:1, minWidth:220, background:'#fff1f1', borderRadius:12, padding:18, textAlign:'center'}}>
                    <Text as="h2" variant="headingLg" tone="critical">{failed}</Text>
                    <Text as="p" tone="subdued">Failed</Text>
                  </div>
                  <div style={{flex:1, minWidth:220, background:'#f6f8fb', borderRadius:12, padding:18, textAlign:'center'}}>
                    <Text as="h2" variant="headingLg">{remaining}</Text>
                    <Text as="p" tone="subdued">Remaining</Text>
                  </div>
                </div>
                
                {/* Completion buttons */}
                {processed >= total && total > 0 && (
                  <div style={{marginTop: '16px'}}>
                    <Box padding="400" background="bg-surface-success" borderRadius="300">
                      <InlineStack gap="300" align="center" blockAlign="center">
                        <div>
                          <Text as="h3" variant="headingMd" tone="success">✅ Import Completed!</Text>
                          <Text as="p" variant="bodyMd">
                            Successfully imported {success} products. {failed > 0 ? `${failed} products failed.` : ''}
                          </Text>
                        </div>
                        <Button onClick={() => navigate('/app/connection-management')} variant="primary">
                          Go to Dashboard
                        </Button>
                      </InlineStack>
                    </Box>
                  </div>
                )}
              </Box>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
    </Card>
  );
}
